import getPortfolioDetails from '@salesforce/apex/DocumentUploaderController.getPortfolioDetails';
import getContentDocumentIds from '@salesforce/apex/DocumentUploaderController.getContentDocumentIds';
import createDocumentRecords from '@salesforce/apex/DocumentUploaderController.createDocumentRecords';
import createContentDocumentLink from '@salesforce/apex/DocumentUploaderController.createContentDocumentLink';
import getAllPortfoliosByType from '@salesforce/apex/DocumentUploaderController.selectByPortfolioType';

export default class ApexService {
  async callGetPortfolioDetails(portfolioIdentifierArr, selectedPortfolioType) {
    const portIdentifierToPortDetails =
          await getPortfolioDetails({
            portfolioIdentifierList: portfolioIdentifierArr,
            portfolioType: selectedPortfolioType,
          });

    return portIdentifierToPortDetails;
  }

  async callGetContentDocumentIds(contentVersionIdArr) {
    const contentVerIdToContentDocumentId =
      await getContentDocumentIds({ contentVersionIdList: contentVersionIdArr });
    return contentVerIdToContentDocumentId;
  }

  async callCreateDocumentRecords(documentsInsertList) {
    const fileIdToDocumentId =
      await createDocumentRecords({ documentInsertList: documentsInsertList });
    return fileIdToDocumentId;
  }

  async callCreateContentDocumentLink(documentIdToContentDocId) {
    const docIdTocdlId =
      await createContentDocumentLink({ documentIdToContentDocIdMap: documentIdToContentDocId });
    return docIdTocdlId;
  }

  async callGetAllPortfoliosByType(selectedPortfolioType) {
    const portfolioList =
          await getAllPortfoliosByType({
            portfolioType: selectedPortfolioType,
          });

    return portfolioList;
  }
}