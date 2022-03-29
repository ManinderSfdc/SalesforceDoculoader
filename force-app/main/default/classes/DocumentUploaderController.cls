/**
 * @description This class provides DML services to the documentUploader LWC component. This component enables
 * mass upload of files to portfolios.
 * @author maninder.singh
 **/

public with sharing class DocumentUploaderController {

    public class DocumentUploaderException extends Exception {
    }

    @AuraEnabled
    public static Map<String, String> getContentDocumentIds(List<String> contentVersionIdList) {
        Map<String, String> cVIdToConDocIdMap = new Map<String, String>();
        Map<Id, ContentVersion> cVIdtoCVMap = new Map<Id, ContentVersion>(
            [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id IN :contentVersionIdList WITH SECURITY_ENFORCED]
        );

        for (string cvid : cVIdtoCVMap.keyset()) {
            cVIdToConDocIdMap.put(cvid, cVIdtoCVMap.get(cvid).ContentDocumentId);
        }
        return cVIdToConDocIdMap;
    }

    @AuraEnabled
    public static Map<String, String> createDocumentRecords(List<Map<String, String>> documentInsertList) {
        List<Document__c> documentToInsertList = new List<Document__c>();
        Map<String, String> fileIdToDocumentIdMap = new Map<String, String>();
        List<String> fileIdList = new List<String>();

        for (Map<String, String> docMap : documentInsertList) {
            Document__c doc = new Document__c(
                Portfolio__c = docMap.get('portfolioId'),
                DocumentName__c = docMap.get('DocumentName'),
                Description__c = docMap.get('Description'),
                Type__c = docMap.get('Type'),
                PublishedDate__c = (Datetime) Date.valueof(docMap.get('publishDate'))
            );
            documentToInsertList.add(doc);
            fileIdList.add(docMap.get('id'));
           
        }

        Database.SaveResult[] documentsInsertedResult = insertWithErrorHandling(documentToInsertList, true);
        for (Integer index = 0; index < documentsInsertedResult.size(); index++) {
            Database.SaveResult sr = documentsInsertedResult.get(index);
                fileIdToDocumentIdMap.put(fileIdList[index], sr.getId());
        }
        return fileIdToDocumentIdMap;
    }

    @AuraEnabled
    public static Map<String, String> createContentDocumentLink(Map<String, String> documentIdToContentDocIdMap) {
        List<ContentDocumentLink> contentDocumentLinkToInsert = new List<ContentDocumentLink>();
        Map<String, String> docIdTocdlId = new Map<String, String>();

        for (string docId : documentIdToContentDocIdMap.keyset()) {
            ContentDocumentLink link = new ContentDocumentLink(
                LinkedEntityId = docId,
                ContentDocumentId = documentIdToContentDocIdMap.get(docId),
                ShareType = 'V',
                Visibility = 'AllUsers'
            );
            contentDocumentLinkToInsert.add(link);
        }

        Database.SaveResult[] contentDocumentLinksResult = insertWithErrorHandling(contentDocumentLinkToInsert, true);
        for (Integer index = 0; index < contentDocumentLinksResult.size(); index++) {
            Database.SaveResult sr = contentDocumentLinksResult.get(index);
            docIdTocdlId.put(contentDocumentLinkToInsert[index].LinkedEntityId, sr.getId());
        }
        return docIdTocdlId;
    }

    @AuraEnabled
    public static Map<String, Map<String, String>> getPortfolioDetails(
        List<String> portfolioIdentifierList,
        String portfolioType
    ) {
        Map<String, Map<String, String>> queriedPortIdentifierToPortDetailsMap = new Map<String, Map<String, String>>();
        Map<String, Map<String, String>> portIdentifierToPortDetailsMap = new Map<String, Map<String, String>>();

        queriedPortIdentifierToPortDetailsMap = queryPortfolioDetails(portfolioIdentifierList, portfolioType);

        for (string portIdentifier : portfolioIdentifierList) {
            if (queriedPortIdentifierToPortDetailsMap.containsKey(portIdentifier)) {
                portIdentifierToPortDetailsMap.put(
                    portIdentifier,
                    queriedPortIdentifierToPortDetailsMap.get(portIdentifier)
                );
            } else {
                Map<String, String> portfolioDetailsMap = new Map<String, String>();
                portIdentifierToPortDetailsMap.put(portIdentifier, portfolioDetailsMap);
            }
        }
        return portIdentifierToPortDetailsMap;
    }

    /**
    * @description Queries Portfolios and checks duplicates based on `portfolioIdentifier`
    * @param List<String> portfolioIdentifierList 
    * @return Map<String, Map<String, String>> 
    **/
    public static Map<String, Map<String, String>> queryPortfolioDetails(List<String> portfolioIdentifierList, String portfolioType) {
        Map<String, Map<String, String>> queriedPortIdentifierToPortDetailsMap = new Map<String, Map<String, String>>();
        Map<Id, Portfolio__c> portIdtoPortfolioMap = new Map<Id, Portfolio__c>(
            [
                SELECT Id, PortfolioNumber__c, Name
                FROM Portfolio__c
                WHERE PortfolioNumber__c IN :portfolioIdentifierList 
                AND PortfolioType__c = :portfolioType
                WITH SECURITY_ENFORCED
            ]
        );

        for (string portId : portIdtoPortfolioMap.keyset()) {
            Map<String, String> portfolioDetailsMap = new Map<String, String>();
            String portfolioIdentifier = portIdtoPortfolioMap.get(portId).PortfolioNumber__c;
            if (queriedPortIdentifierToPortDetailsMap.containsKey(portfolioIdentifier)) {
                String duplicateRecords = queriedPortIdentifierToPortDetailsMap.get(portfolioIdentifier)
                    .get('duplicateRecords');
                if (duplicateRecords == null) {
                    duplicateRecords = queriedPortIdentifierToPortDetailsMap.get(portfolioIdentifier)
                        .get('portfolioId');
                }
                duplicateRecords += ',' + portId;
                portfolioDetailsMap.put('duplicateRecords', duplicateRecords);
                queriedPortIdentifierToPortDetailsMap.put(portfolioIdentifier, portfolioDetailsMap);
                continue;
            }
            portfolioDetailsMap.put('portfolioId', portId);
            portfolioDetailsMap.put('portfolioName', portIdtoPortfolioMap.get(portId).Name);

            queriedPortIdentifierToPortDetailsMap.put(portfolioIdentifier, portfolioDetailsMap);
        }
        return queriedPortIdentifierToPortDetailsMap;
    }

    @AuraEnabled
    public static List<Portfolio__c> selectByPortfolioType(String portfolioType) {
        List<Portfolio__c> portfoliosDetails = new List<Portfolio__c>();
        portfoliosDetails = [
                SELECT Id, Name
                FROM Portfolio__c
                WHERE
                    PortfolioType__c = :portfolioType
                WITH SECURITY_ENFORCED
            ];
        return portfoliosDetails;
    }

    private static Database.SaveResult[] insertWithErrorHandling(List<SObject> sObjectList, Boolean allOrNone) {
        try {
            Database.SaveResult[] saveResults = Database.insert(sObjectList, allOrNone);
            return saveResults;
        } catch (Exception e) {
            throw new DocumentUploaderException('Apex Error: ', e);
        }
    }
}