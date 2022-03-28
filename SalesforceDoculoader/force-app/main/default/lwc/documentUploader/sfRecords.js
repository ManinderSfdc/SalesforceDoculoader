import ApexService from './apexService';
import HelperMethods from './helperMethods';

const apexService = new ApexService();
const helperMethods = new HelperMethods();

export default class SfRecords {
  errorObject = { body: { message: '' } };

  async createRelatedRecordsInSalesforce(fileUploadResponse) {
    let processedRecords = [...fileUploadResponse];
    let runningMethod = '';

    const { contentVersionIdArr, documentsInsertList } =
      await this.parseFileUploadResponse(fileUploadResponse);

    try {
      if (contentVersionIdArr.length === 0) {
        this.errorObject.body.message = 'Error in File upload.';
        throw this.errorObject;
      }
      runningMethod = 'getContentDocumentIds';
      const contentVerIdToContentDocumentId =
        await apexService.callGetContentDocumentIds(contentVersionIdArr);
      if (Object.keys(contentVerIdToContentDocumentId).length < 1) {
        this.errorObject.body.message = 'getContentDocumentIds returned 0 results';
        throw this.errorObject;
      }

      // responseWithContentDocumentId has file details of only the records
      //  inserted using contentVersionIdArr
      const responseWithContentDocumentId = [];
      fileUploadResponse.forEach((row) => {
        const dataRow = { ...row };
        dataRow.contentDocumentId = contentVerIdToContentDocumentId[row.cvId];
        dataRow.contentDocumentIdLink = `/${contentVerIdToContentDocumentId[row.cvId]}`;
        responseWithContentDocumentId.push(dataRow);
      });
      processedRecords = [...responseWithContentDocumentId];

      runningMethod = 'createDocumentRecords';
      // fileIdToDocumentId, where fileId is in format File1, File2, FileN ...
      const fileIdToDocumentId =
        await apexService.callCreateDocumentRecords(documentsInsertList);
      if (Object.keys(fileIdToDocumentId).length < 1) {
        this.errorObject.body.message = 'fileIdToDocumentId returned 0 results';
        throw this.errorObject;
      }

      const documentIdToContentDocId = {};
      const documentIdToContentVersion = {};
      const responseWithDocumentDetails = [];
      responseWithContentDocumentId.forEach((row) => {
        const dataRow = { ...row };
        const documentId = fileIdToDocumentId[dataRow.id];
        dataRow.documentId = `/${documentId}`;
        dataRow.documentLabel = 'View';
        documentIdToContentDocId[documentId] = dataRow.contentDocumentId;
        documentIdToContentVersion[documentId] =
          { cvId: dataRow.cvId, fileName: dataRow.file.name };
        responseWithDocumentDetails.push(dataRow);
      });
      processedRecords = [...responseWithDocumentDetails];

      runningMethod = 'createContentDocumentLink';
      if (Object.keys(documentIdToContentDocId).length < 1) {
        this.errorObject.body.message = 'documentIdToContentDocId has 0 records.';
        throw this.errorObject;
      }

      const docIdTocdlId =
        await apexService.callCreateContentDocumentLink(documentIdToContentDocId);
    } catch (error) {
      const processedRecordsWithError = [];
      let errorMessage = `Error in executing ${runningMethod}. `;
      errorMessage += helperMethods.reduceErrors(error);
      processedRecords.forEach((row) => {
        if (row.success === false) { // retain previous error
          processedRecordsWithError.push(row);
          return; // continue to next record
        }
        const dataRow = { ...row };
        dataRow.success = false;
        dataRow.successIcon = 'standard:first_non_empty';
        dataRow.error = errorMessage;
        processedRecordsWithError.push(dataRow);
      });
      processedRecords = [...processedRecordsWithError];
    }
    return processedRecords;
  }

  async parseFileUploadResponse(fileUploadResponse) {
    const contentVersionIdArr = [];
    const documentsInsertList = [];
    // Process only successful file upload records and ignore the errored records
    fileUploadResponse.forEach((row) => {
      if (row.success === true) { // if file upload is success
        contentVersionIdArr.push(row.cvId);
        const docAttr = {
          id: row.id,
          // id => unique Id assigned to each file in `HelperMethods.createTableData` method. 
          // Ex: File1, File2 ...
          portfolioId: row.portfolioId,
          DocumentName: row.file.name,
          Description: row.description,
          Type: row.type,
          publishDate: row.publishDate,
        };
        documentsInsertList.push(docAttr);
      }
    });
    return { contentVersionIdArr, documentsInsertList };
  }
}
