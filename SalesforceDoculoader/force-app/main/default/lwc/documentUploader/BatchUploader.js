import FormDataBuilder from './formdata';
import AxiosUtility from './axiosUtility';
import HelperMethods from './helperMethods';
import CONSTANTS from './constants';
import SfRecords from './sfRecords';

const { BYTES_PER_MEGABYTE } = CONSTANTS;
const helperMethods = new HelperMethods();
const sfRecordsInstance = new SfRecords();

export class BatchUploader {
  axios;
  filesProcessedInThisBatch = [];
  uploadResult = [];
  subscribedProgressBarFunctions = [];
  subscribedMessageUpdateFunction = [];
  parent;
  dataFieldName;
  errorObject = { body: { message: '' } };

  constructor(axios, parent, dataFieldName) {
    this.axios = axios;
    this.parent = parent;
    this.dataFieldName = dataFieldName;
  }

  // method to subscribe functions for Progress bar update
  subscribeForProgressBar(functionToSubscribe) {
    this.subscribedProgressBarFunctions.push(functionToSubscribe);
  }

  // method to subscribe functions for message updates on the UI
  subscribeForMessageUpdate(functionToSubscribe) {
    this.subscribedMessageUpdateFunction.push(functionToSubscribe);
  }

  updateStatusOnUI(msg) {
    this.subscribedMessageUpdateFunction.forEach((callback) => {
      callback(msg);
    });
  }
  /**
 * parse all files and create JSON request for each batch of files .
 * @param {{}[]}  fileList containing the file blobs and other attributes.
 * @param {Number} maxSize max size in MB for each batch .
 * @returns {Array} array containing the file blobs and other attributes with result data.
 */
  async uploadFiles(fileList, maxSize) {
    const allFilesProcessedWithDetails = [];
    let batchSize = 0;
    let batchFileSizeInMb = 0;
    let batchNum = 0;
    const maxSizeInBytes = maxSize * BYTES_PER_MEGABYTE; // convert MB to Bytes
    const totalNoOfBatches = helperMethods.calculateTotalNoOfBatches(fileList, maxSizeInBytes);
    allFilesProcessedWithDetails.push(...fileList);
    // process files in batches
    for (let nFileId = 1; nFileId <= fileList.length; nFileId += batchSize) {
      const batchDetails = helperMethods.createBatch(fileList, maxSizeInBytes, nFileId - 1);
      batchSize = batchDetails.batchSize;
      batchFileSizeInMb = batchDetails.batchFileSizeInMb;
      batchNum += 1;

      let msg = {
        message: 'File Upload InProgress. Check the status here.',
        progressBarMessage: `Preparing files for Batch: ${batchNum}`,
        batchNo: `${batchNum}/${totalNoOfBatches}`,
        filesInBatch: batchSize,
        totalSizeOfFilesInBatch: batchFileSizeInMb,
      };
      this.updateStatusOnUI(msg);
      // creates formData for files in current batch
      const formData = this.createFormData(fileList, nFileId, batchSize);
      msg = {
        message: 'File Upload InProgress. Check the status here.',
        progressBarMessage: `Uploading Files for Batch: ${batchNum}`,
        batchNo: `${batchNum}/${totalNoOfBatches}`,
        filesInBatch: batchSize,
        totalSizeOfFilesInBatch: batchFileSizeInMb,
      };
      this.updateStatusOnUI(msg);
      /* call rest api to insert contentVersions in salesforce.
       * we chose to seqentially upload batches for simplicity of mapping the results back to the
       * original file selected by the user and reducing complexity of parallel uploads.
      */
      // eslint-disable-next-line no-await-in-loop
      await this.insertCV(formData, fileList);

      msg = {
        message: 'File Upload InProgress. Check the status here.',
        progressBarMessage: `Attaching files to the portfolios for Batch: ${batchNum}`,
        batchNo: `${batchNum}/${totalNoOfBatches}`,
        filesInBatch: batchSize,
        totalSizeOfFilesInBatch: batchFileSizeInMb,
      };
      this.updateStatusOnUI(msg);
      const recordsProcessedInThisBatch =
        // eslint-disable-next-line no-await-in-loop
        await sfRecordsInstance.createRelatedRecordsInSalesforce(this.uploadResult);

      // enrich allFilesProcessedWithDetails with recordsProcessedInThisBatch
      recordsProcessedInThisBatch.forEach((processedRecord) => {
        allFilesProcessedWithDetails[allFilesProcessedWithDetails.findIndex((unprocessedRecord) =>
          unprocessedRecord.id === processedRecord.id)] = processedRecord;
      });
      this.uploadResult = [];
      // update Table data with results
      this.parent[this.dataFieldName] = [...allFilesProcessedWithDetails];
    }
  }

  createFormData(fileList, nFileId, batchSize) {
    this.filesProcessedInThisBatch = [];
    const recordAttributes = [];
    const binaryPartIds = [];
    for (let FileId = nFileId - 1; FileId < nFileId - 1 + batchSize; FileId += 1) {
      this.filesProcessedInThisBatch.push(fileList[FileId].id);
      /*
      *create JSON request for blob insert using SObject Collections API
      * https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_sobject_insert_update_blob.htm#sobject_collections
      * https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections_create.htm
      */
      recordAttributes.push({
        attributes:
        {
          type: 'ContentVersion',
          binaryPartName: `File${FileId}`,
          binaryPartNameAlias: 'VersionData',
        },
        PathOnClient: fileList[FileId].file.name,
        Title: fileList[FileId].file.name,
        Source__c: 'Doculoader', // populate any custom field on ContentVersion object
      });
      binaryPartIds.push(FileId);
    }
    const fd = new FormDataBuilder();
    fd.append(
      'entity_content',
      JSON.stringify(
        {
          allOrNone: true,
          records: recordAttributes,
        },
        null,
        '    ',
      ),
      { contentType: 'application/json' },
    );
    // add a binary to the formdata
    binaryPartIds.forEach((fileId) => {
      fd.append(
        `File${fileId}`,
        fileList[fileId].file,
        fileList[fileId].file.name,
      );
    });
    return fd;
  }

  /**
   * call rest api and set headers
   * @param {{}[]}  fileList containing the file blobs and other attributes.
   * @param {{}} fd having the form data created using formdata.js.
   */
  async insertCV(fd, fileList) {
    // set config for axios instance
    const config = {
      onUploadProgress: (progressEvent) => {
        // axios executes this callback function when there is change in file upload progress
        // and we call the subscribed functions to update the UI
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        this.subscribedProgressBarFunctions.forEach((callback) => {
          callback(percentCompleted);
        });
      },
      headers: fd.getHeaders(),
    };

    try {
      const response = await this.axios.sendPostRequest('/services/data/v51.0/composite/sobjects', fd.getBlob(), config);
      // parse the response data
      this.parseResponse(response.data, fileList);
    } catch (error) {
      this.errorObject.body.message = `Error in sending file upload request to salesforce: ${error}`;
      throw this.errorObject;
    }
  }
  /**
   * parse rest api response and update {uploadResult}  with result data
   * @param {{}[]}  fileList containing the file blobs and other attributes.
   * @param {{}[]} restResponseData array of objects having success and errors .
   */
  parseResponse(restResponseData, fileList) {
    let index = 0;
    fileList.forEach((row) => {
      if (this.filesProcessedInThisBatch.includes(row.id)) {
        const dataRow = { ...row };
        dataRow.success = restResponseData[index].success;
        dataRow.cvId = restResponseData[index].id;
        dataRow.successIcon = 'action:approval';
        if (restResponseData[index].errors.length > 0) {
          dataRow.error = `statusCode: ${restResponseData[index].errors[0].statusCode
          }; Message: ${restResponseData[index].errors[0].message}`;
          dataRow.successIcon = 'standard:first_non_empty';
        }
        this.uploadResult.push(dataRow);
        index += 1;
      }
    });
  }
}

export async function getFileBatcherInstance(parent, dataFieldName) {
  const AxiosUtilityInstance = new AxiosUtility();
  await AxiosUtilityInstance.retrieveSessionData();
  const fileBatcher = new BatchUploader(AxiosUtilityInstance, parent, dataFieldName);
  return fileBatcher;
}