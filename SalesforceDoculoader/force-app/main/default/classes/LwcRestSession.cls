public with sharing class LwcRestSession {

    @AuraEnabled
    public static String getRestSessionId() {
        try{
            return Page.LwcRestSessionId.getContent().toString();
        }catch(Exception e){
            return 'Session Id not found.';
        }
    }

    @AuraEnabled
    public static String getBaseUrl(){
        return URL.getSalesforceBaseUrl().toExternalForm();
    }
}