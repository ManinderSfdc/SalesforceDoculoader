import CONSTANTS from './constants';
import ApexService from './apexService';

const apexService = new ApexService();
export default class HelperMethods {
  /**
  * calculate total size of all files.
  * @param {Array}  fileList containing the file blobs and other attributes.
  * @param {Number}  maxSizeInBytes max size in MB for each batch .
  * @returns {String} string total file size.
  */
  calculateTotalFileSize(fileList) {
    let totalFileSize = 0;
    const fileArr = fileList.map((value) => value.file);
    let totalSize;

    fileArr.forEach((file) => { totalFileSize += file.size; });
    // code for multiples approximation
    const aMultiples = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    // eslint-disable-next-line max-len
    for (let nMultiple = 0, nApprox = totalFileSize / 1024; nApprox > 1; nApprox /= 1024, nMultiple += 1) {
      totalSize = `${nApprox.toFixed(2)} ${aMultiples[nMultiple]}`;
    }
    return totalSize;
  }

  calculateTotalNoOfBatches(fileList, maxSizeInBytes) {
    let calculatedFileSize = 0;
    const fileArr = fileList.map((value) => value.file);
    let batchSize = 0;
    let totalNoOfBatches = 0;

    fileArr.forEach((file) => {
      calculatedFileSize += file.size;
      batchSize += 1;
      if (calculatedFileSize >= maxSizeInBytes || batchSize >= CONSTANTS.MAX_BATCH_SIZE) {
        totalNoOfBatches += 1;
        batchSize = 0;
        calculatedFileSize = 0;
      }
    });

    // count the last batch
    if (totalNoOfBatches > 0 && batchSize > 0) {
      totalNoOfBatches += 1;
    }
    // if no of files uploaded are less than MAX_BATCH_SIZE
    if (totalNoOfBatches === 0 && batchSize < CONSTANTS.MAX_BATCH_SIZE) {
      totalNoOfBatches = 1;
    }

    return totalNoOfBatches;
  }

  /**
   * create batch of files based on the file size.
   * @param {{}[]} fileList  containing the file blobs and other attributes.
   * @param {Number} maxSize max size in MB for each batch .
   * @param {Number} startIndex start index in the file array {oFiles}
   * from which the batch is created
   * @returns {Number} int batch size which is the count of files to be processed.
   */
  createBatch(fileList, maxSizeInBytes, startIndex) {
    let calculatedSize = 0;
    const fileArr = fileList.map((value) => value.file);
    let batchSize = 0;

    for (let fileId = startIndex; fileId < fileArr.length; fileId += 1) {
      calculatedSize += fileArr[fileId].size;
      if (calculatedSize >= maxSizeInBytes || batchSize >= CONSTANTS.MAX_BATCH_SIZE) {
        break;
      }
      batchSize += 1;
    }
    const batchFileSizeInMb = (calculatedSize / CONSTANTS.BYTES_PER_MEGABYTE).toFixed(2);
    return { batchSize, batchFileSizeInMb };
  }

  parseFileNameForPortfolioIdentifier(filename) {
    const sepPos = filename.indexOf('_');
    if (sepPos === -1) {
      return '';
    }
    // convert the file names to NFC format. OS X saves file name in NFD format.
    // https://stackoverflow.com/questions/6153345/different-utf8-encoding-in-filenames-os-x
    return filename.substring(0, sepPos).normalize('NFC');
  }

  /**
   * generic method to parse JS,Apex,custom errors
   * @param {Array}  errors Error object
   * @returns {String} string of comma separated error messages.
  */
  reduceErrors(err) {
    let errors;
    if (!Array.isArray(err)) {
      errors = [err];
    }
    return (
      errors
        // Remove null/undefined items
        .filter((error) => !!error)
        // Extract an error message
        .map((error) => {
          // UI API read errors
          if (Array.isArray(error.body)) {
            return error.body.map((e) => e.message);
          }
          // UI API DML, Apex and network errors
          if (error.body && typeof error.body.message === 'string') {
            return error.body.message;
          }
          // JS errors
          if (typeof error.message === 'string') {
            return error.message;
          }
          // Unknown error shape so try HTTP status text
          return error.statusText;
        })
        // Flatten
        .reduce((prev, curr) => prev.concat(curr), [])
        // Remove empty strings
        .filter((message) => !!message)
    );
  }

  setColumnsForReviewTable(actions) {
    return ([
      {
        label: 'Review Status',
        fieldName: '',
        cellAttributes: { iconName: { fieldName: 'reviewSuccessIcon' }, iconPosition: 'left' },
      },
      {
        label: 'Portfolio',
        fieldName: 'portfolio',
        type: 'url',
        typeAttributes: { label: { fieldName: 'portfolioLabel' }, target: '_blank' },
      },
      { label: 'Document Name', fieldName: 'documentName' },
      { label: 'Publish Date', fieldName: 'publishDate' },
      { label: 'Description', fieldName: 'description' },
      { label: 'Type', fieldName: 'type' },
      { label: 'Error', fieldName: 'reviewError' },
      {
        type: 'action',
        typeAttributes: { rowActions: actions },
      },
    ]);
  }

  setColumnsForUploadResultTable() {
    return ([
      {
        label: 'Upload Status',
        fieldName: '',
        cellAttributes: { iconName: { fieldName: 'successIcon' }, iconPosition: 'left' },
      },
      {
        label: 'Portfolio',
        fieldName: 'portfolio',
        type: 'url',
        typeAttributes: { label: { fieldName: 'portfolioLabel' }, target: '_blank' },
      },
      { label: 'Document Name', fieldName: 'documentName' },
      { label: 'Publish Date', fieldName: 'publishDate' },
      { label: 'Description', fieldName: 'description' },
      { label: 'Type', fieldName: 'type' },
      { label: 'Error', fieldName: 'error' },
      {
        label: 'Attachment',
        fieldName: 'contentDocumentIdLink',
        type: 'url',
        typeAttributes: {
          label: 'View',
          target: '_blank',
        },
        cellAttributes: { iconName: 'utility:file', iconPosition: 'left' },
      },
      {
        label: 'Document',
        fieldName: 'documentId',
        type: 'url',
        typeAttributes: {
          label: { fieldName: 'documentLabel' },
          target: '_blank',
        },
      },

    ]);
  }

  createTableData(fileListArray, userInputs) {
    const userInput = userInputs;
    const tableData = [];
    for (let nFileId = 0; nFileId < fileListArray.length; nFileId += 1) {
      const docAttr = {
        id: `File${nFileId}`,
        documentName: fileListArray[nFileId].file.name,
        description: userInput.description,
        type: userInput.documentType,
        publishDate: userInput.publishDate,
        reviewSuccessIcon: 'action:approval',
        reviewSuccess: true,
      };

      /* create array of objects with file blobs and related attributes for each file.
       *[ {description: "df", documentName: "University.pdf",
       *file: File, id: "File0", internal: true, portfolio: "/a005r0000013bCpAAI",
       *portfolioLabel: "test1"},
       *  ...
       * ] */
      tableData.push(Object.assign(fileListArray[nFileId], docAttr));
    }
    return tableData;
  }

  async extendTableDataForUploadWithPortfolioType(tableData, portfolioIdentifierArr, selectedPortfolioType) {
    const portIdentifierToPortDetails =
      await apexService.callGetPortfolioDetails(portfolioIdentifierArr, selectedPortfolioType);
    const extendedTableData = [];
    for (let nFileId = 0; nFileId < tableData.length; nFileId += 1) {
      const currentFile = tableData[nFileId];
      const currentPortfolioDetail = portIdentifierToPortDetails[currentFile.portfolioIdentifier];
      const docAttr = {};
      docAttr.portfolio = `/${currentPortfolioDetail.portfolioId}`;
      docAttr.portfolioId = currentPortfolioDetail.portfolioId;
      docAttr.portfolioLabel = currentPortfolioDetail.portfolioName;

      if (currentPortfolioDetail.duplicateRecords) {
        docAttr.portfolioLabel = '';
        docAttr.portfolio = '';
        docAttr.portfolioId = '';
        docAttr.reviewError = `Duplicate Portfoilios found with key: ${currentFile.portfolioIdentifier}. Duplicate IDs: ${currentPortfolioDetail.duplicateRecords}`;
        docAttr.reviewSuccessIcon = 'standard:first_non_empty';
        docAttr.reviewSuccess = false;
      } else if (!currentPortfolioDetail.portfolioId) {
        docAttr.portfolioLabel = 'Not Found';
        docAttr.portfolio = 'Not Found';
        docAttr.portfolioId = 'Not Found';
        docAttr.reviewError = `Portfolio not found for this key: ${currentFile.portfolioIdentifier}`;
        docAttr.reviewSuccessIcon = 'standard:first_non_empty';
        docAttr.reviewSuccess = false;
      }
      extendedTableData.push(Object.assign(tableData[nFileId], docAttr));
    }
    return extendedTableData;
  }

  async createFileListWhenUploadWithPortfolioType(fileList, selectedPortfolioType) {
    const fileListArray = [];
    const portfolioList =
      await apexService.callGetAllPortfoliosByType(selectedPortfolioType);
    if (portfolioList.length === 0) {
      return fileListArray;
    }

    portfolioList.forEach((portfolio) => {
      const portIdentifier = portfolio.Id;
      Object.values(fileList).forEach((value) => {
        fileListArray.push(
          {
            file: value,
            portfolioIdentifier: portIdentifier,
            portfolio: `/${portIdentifier}`,
            portfolioId: portIdentifier,
            portfolioLabel: portfolio.Name,
          },
        );
      });
    });
    return fileListArray;
  }

  deleteRow(row, tableData) {
    const { id } = row;
    let modifiedTableData;
    const index = this.findRowIndexById(id, tableData);
    if (index !== -1) {
      modifiedTableData = tableData
        .slice(0, index)
        .concat(tableData.slice(index + 1));
    }
    return (modifiedTableData);
  }

  findRowIndexById(id, tableData) {
    let ret = -1;
    tableData.some((row, index) => {
      if (row.id === id) {
        ret = index;
        return true;
      }
      return false;
    });
    return ret;
  }
}