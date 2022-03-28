import { LightningElement, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getRecord } from 'lightning/uiRecordApi';

import DOCUMENT_TYPE_FIELD from '@salesforce/schema/Document__c.Type__c';
import DOCUMENT_DESCRIPTION_FIELD from '@salesforce/schema/Document__c.Description__c';
import DOCUMENT_OBJECT from '@salesforce/schema/Document__c';
import PORTFOLIO_OBJECT from '@salesforce/schema/Portfolio__c';
import PORTFOLIO_NAME_FIELD from '@salesforce/schema/Portfolio__c.Name';
import PORTFOLIO_TYPE_FIELD from '@salesforce/schema/Portfolio__c.PortfolioType__c';

import { getFileBatcherInstance } from './BatchUploader';
import HelperMethods from './helperMethods';
import CONSTANTS from './constants';

const {
  COLOR_YELLOW,
  COLOR_RED,
  MAX_FILEBATCH_SIZE,
} = CONSTANTS;
const helperMethods = new HelperMethods();
export default class DocumentUploader extends LightningElement {
  @api recordId;

  data = [];
  record = {};
  disableConfirmButton = false;
  disableReviewButton = false;
  batchNo = '';
  messageBackground;
  filesInBatch = '';
  totalSizeOfFilesInBatch = '';
  progressBarMessage = '';
  showProgress = false;
  selectedPortfolioType;
  totalFileSize;
  reviewedDocumentsInsertListWithBlob;
  errorObject = { body: { message: '' } };
  portfolioRecord;
  allDetailsOfUploadedFiles = {};
  activePortfolioId;
  message = '';
  progress = 0;
  columns = [];
  showOtherDescription = false;
  actions = [
    { label: 'Delete', name: 'delete' },
  ];
  isUploadWithFileName = true; // defaults to this upload tab
  isUploadWithPortfolioType = false;
  investmentStrategies;
  riskLevels;

  connectedCallback() {
    // get the protfolioId from the record page
    this.activePortfolioId = this.recordId;
  }

  @wire(getRecord, { recordId: '$recordId', fields: [PORTFOLIO_NAME_FIELD] })
  wiredPortfolioRecord({ error, data }) {
    if (error) {
      const message = 'Unknown error';
      helperMethods.reduceErrors(error);
      this.displayToast('Error loading Portfolio Record', message, 'error');
    } else if (data) {
      this.portfolioRecord = data;
    }
  }

  @wire(getObjectInfo, { objectApiName: DOCUMENT_OBJECT })
  documentObjectInfo;

  @wire(getObjectInfo, { objectApiName: PORTFOLIO_OBJECT })
  PortfolioObjectInfo;

  // gets picklist values for DocumentType
  @wire(getPicklistValues, {
    recordTypeId: '$documentObjectInfo.data.defaultRecordTypeId',
    fieldApiName: DOCUMENT_TYPE_FIELD,
  })
  documentTypes;

  // gets picklist values for Document Description
  @wire(getPicklistValues, {
    recordTypeId: '$documentObjectInfo.data.defaultRecordTypeId',
    fieldApiName: DOCUMENT_DESCRIPTION_FIELD,
  })
  documentDescriptions;

  @wire(getPicklistValues, {
    recordTypeId: '$PortfolioObjectInfo.data.defaultRecordTypeId',
    fieldApiName: PORTFOLIO_TYPE_FIELD,
  })
  portfolioTypes;

  get isOnRecordDetailPage() {
    return this.recordId !== undefined;
  }

  areRequiredValuesSet() {
    const requiredFields = [...this.template.querySelectorAll(
      '[data-id="documentType"],[data-id="portfolioType"],[data-id="description"],[data-id="publishDate"]',
    )];
    const allValid = requiredFields
      .reduce((validSoFar, inputCmp) => {
        inputCmp.reportValidity();
        return validSoFar && inputCmp.checkValidity();
      }, true);
    if (allValid) {
      const fileList = this.template.querySelector('[name="fileinput"]').files;
      if (fileList.length < 1) {
        this.message = 'Select Files to upload.';
        return false;
      }
      // All form entries look valid
      return true;
    }
    this.message = 'Fill in all the Required Fields.';
    return false;
  }

  // getter to set styles dynamically for displaying messages of info, success and error.
  get messageStyle() {
    return `background:${this.messageBackground};`;
  }

  handleActiveTab(event) {
    this.isUploadWithPortfolioType = false;
    this.isUploadWithFileName = false;
    const portfolioTypeSelector = this.template.querySelector('[data-id="portfolioType"]');
    this.selectedPortfolioType = portfolioTypeSelector ? portfolioTypeSelector.value : '';

    switch (event.target.value) {
      case 'uploadWithFileName':
        this.isUploadWithFileName = true;
        break;
      case 'uploadWithPortfolioType':
        this.isUploadWithPortfolioType = true;
        break;
      default:
    }
  }
  
  handlePortfolioTypeSelection(event) {
    this.selectedPortfolioType = event.detail.value;
  }

  // event handler for "Confirm Upload" button
  async handleConfirmUpload() {
    this.disableConfirmButton = true;
    this.reviewedDocumentsInsertListWithBlob = [...this.data];// shallow clone
    this.confirmUpload(this.reviewedDocumentsInsertListWithBlob);
  }

  setAttributesForReview() {
    // clear messages and set columns in data table
    this.progressBarMessage = '';
    this.batchNo = '';
    this.filesInBatch = '';
    this.totalSizeOfFilesInBatch = '';
    this.showProgress = false;
    this.messageBackground = COLOR_YELLOW;
    this.disableConfirmButton = false;
    this.data = []; // clear the table data

    this.columns = helperMethods.setColumnsForReviewTable(this.actions);
  }

  async createFileListWithBlobAndPortfolioIdentifier() {
    const fileList = this.template.querySelector('[name="fileinput"]').files;
    const portfolioIdentifierArr = [];
    let fileListArray = [];

    if (this.isUploadWithPortfolioType) {
      fileListArray =
        await helperMethods.createFileListWhenUploadWithPortfolioType(fileList, this.selectedPortfolioType);
      if (fileListArray.length === 0) {
        this.message = 'No portfolios found for selected Type.';
      }
      return { fileListArray };
    }

    Object.values(fileList).forEach((value) => {
      let portIdentifier = '';
      if (this.isOnRecordDetailPage) {
        portIdentifier = this.recordId;
      } else if (this.isUploadWithFileName) {
        portIdentifier = helperMethods.parseFileNameForPortfolioIdentifier(value.name);
      }
      portfolioIdentifierArr.push(portIdentifier);
      fileListArray.push(
        {
          file: value,
          portfolioIdentifier: portIdentifier,
        },
      );
    });
    return { fileListArray, portfolioIdentifierArr };
  }

  // event handler for "Review" button
  // eslint-disable-next-line consistent-return
  async handleReview() {
    this.setAttributesForReview();
    if (!this.areRequiredValuesSet()) {
      return 0;
    }
    this.message = 'Reviewing the files. Check Status here.';
    const { fileListArray, portfolioIdentifierArr } =
      await this.createFileListWithBlobAndPortfolioIdentifier();

    let extendedTableData = fileListArray;
    const tableData = helperMethods.createTableData(fileListArray, this.getUserInput());
    if (this.isOnRecordDetailPage) {
      extendedTableData = this.extendTableDataForUploadWithPortfolioId(tableData);
    } else if (this.isUploadWithFileName) {
        extendedTableData =
          await helperMethods.extendTableDataForUploadWithPortfolioType(tableData, portfolioIdentifierArr, this.selectedPortfolioType);
    }
    this.checkErrorFilesInReviewTable(extendedTableData);
    this.totalFileSize = helperMethods.calculateTotalFileSize(extendedTableData);
    this.data = [...extendedTableData];
  }

  extendTableDataForUploadWithPortfolioId(tableData) {
    const extendedTableData = [];
    for (let nFileId = 0; nFileId < tableData.length; nFileId += 1) {
      const docAttr = {};
      docAttr.portfolio = `/${this.recordId}`;
      docAttr.portfolioId = this.recordId;
      docAttr.portfolioLabel = this.portfolioRecord.fields.Name.value;
      extendedTableData.push(Object.assign(tableData[nFileId], docAttr));
    }
    return extendedTableData;
  }

  // method to handle action on each data table row
  handleRowAction(event) {
    const actionName = event.detail.action.name;
    const { row } = event.detail;
    switch (actionName) {
      case 'delete':
        this.data = helperMethods.deleteRow(row, this.data);
        this.checkErrorFilesInReviewTable(this.data);
        break;

      default:
    }
  }

  checkErrorFilesInReviewTable(tableData) {
    let countOfFilesWithReviewError = 0;
    if (tableData.length === 0) {
      this.message = 'No Portfolios found for the selected Type';
      return 0;
    }
    countOfFilesWithReviewError = this.countRecordsWithError(tableData, 'reviewSuccess');
    const countOfSuccessFiles = tableData.length - countOfFilesWithReviewError;
    this.message = `Total Files : ${tableData.length} \n` +
    `Files Reviewed Successfully: ${countOfSuccessFiles} \n`+
    `Files With Error             : ${countOfFilesWithReviewError} \n` +
    'Check the table below.';
    this.disableConfirmButton = countOfFilesWithReviewError > 0;
    return 1;
  }

  countRecordsWithError(tableData, fieldName) {
    let countOfFilesWithError = 0;
    tableData.forEach((row) => {
      if (row[fieldName] === false) {
        countOfFilesWithError += 1;
      }
    });
    return countOfFilesWithError;
  }

  checkErrorFilesInResultTable(tableData) {
    let countOfFilesWithUploadError = 0;
    countOfFilesWithUploadError = this.countRecordsWithError(tableData, 'success');
    const countOfSuccessFiles = tableData.length - countOfFilesWithUploadError;

    this.message = `Total Files : ${tableData.length} \n` +
    `Files Uploaded Successfully: ${countOfSuccessFiles} \n`+
    `Files With Error             : ${countOfFilesWithUploadError} \n` +
    'Check the table below.';
    return countOfFilesWithUploadError;
  }

  getUserInput() {
    const userInput = {};
    userInput.documentType = this.template.querySelector('[data-id="documentType"]').value;
    userInput.publishDate = this.template.querySelector('[data-id="publishDate"]').value;
    const portfolioTypeElement = this.template.querySelector('[data-id="portfolioType"]');
    userInput.productType = portfolioTypeElement ? portfolioTypeElement.value : '';
    userInput.description = this.template.querySelector('[data-id="description"]').value;
    return userInput;
  }

  setTableColumnsForUploadResult() {
    this.columns = helperMethods.setColumnsForUploadResultTable(this.actions);
    if (this.isAccess && this.isUploadWithFileName) {
      this.columns = helperMethods.extendColumnsForAccessPortfolio(this.columns);
    }
  }

  displayToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant,
      }),
    );
  }

  async uploadReviewedFiles(fileList) {
    const fileBatcher = await getFileBatcherInstance(this, 'data');
    fileBatcher.subscribeForMessageUpdate((msg) => {
      this.message = msg.message;
      this.progressBarMessage = msg.progressBarMessage;
      this.batchNo = msg.batchNo;
      this.filesInBatch = msg.filesInBatch;
      this.totalSizeOfFilesInBatch = msg.totalSizeOfFilesInBatch;
    });
    fileBatcher.subscribeForProgressBar((percentCompleted) => {
      this.progress = percentCompleted;
      if (percentCompleted === 100) {
        this.progressBarMessage = 'Processing files on server';
      }
    });
    await fileBatcher.uploadFiles(fileList, MAX_FILEBATCH_SIZE);
  }

  setRecordStatusForProcessing(fileList) {
    let fileListForProcessing = [];
    fileList.forEach((row) => {
      const dataRow = { ...row };
      dataRow.successIcon = 'action:question_post_action';
      fileListForProcessing.push(dataRow);
    });
    return fileListForProcessing;
  }

  /**
   * calls the method to start uploading files in batches and then execute apex methods
   * for creating related records in salesforce.
   * Updates the data table and UI with results and messages.
   * @param {{}[]} files  containing the file blobs and other attributes.
  */
  // eslint-disable-next-line consistent-return
  async confirmUpload(files) {
    this.disableConfirmButton = true;
    this.disableReviewButton = true;
    this.showProgress = true;
    let runningMethod = '';
    let fileList = files;

    this.totalFileSize = helperMethods.calculateTotalFileSize(fileList);
    this.setTableColumnsForUploadResult();
    fileList = this.setRecordStatusForProcessing(fileList);
    this.data = [...fileList];
    runningMethod = 'FileUploadRestRequest';
    try {
      // upload files and attach the files to the portfolios. Also updates the Result table.
      await this.uploadReviewedFiles(fileList);
      this.progressBarMessage = 'Upload Request completed';
      const countOfFilesWithUploadError = this.checkErrorFilesInResultTable(this.data);
      if (countOfFilesWithUploadError > 0) {
        const toastMessage = 'Check the Upload Status section for Details';
        this.displayToast('File Upload Completed with some errors.', toastMessage, 'warning');
      } else {
        const toastMessage = 'Check the Upload Status section for Details';
        this.displayToast('File Upload Completed Successfully.', toastMessage, 'success');
      }
      this.disableReviewButton = false;
    } catch (error) {
      this.displayError(error, runningMethod);
    }
  }

  displayError(error, runningMehtod) {
    this.disableReviewButton = false;
    this.messageBackground = COLOR_RED;
    this.progressBarMessage = `Error in executing ${runningMehtod}. `;
    this.message = `Error in executing ${runningMehtod}. `;
    this.message += helperMethods.reduceErrors(error);
    this.displayToast('File Upload Error.', this.progressBarMessage, 'error');
  }
}
