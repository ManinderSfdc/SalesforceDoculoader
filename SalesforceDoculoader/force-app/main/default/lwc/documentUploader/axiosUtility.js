import getBaseUrl from '@salesforce/apex/LwcRestSession.getBaseUrl';
import getRestSessionId from '@salesforce/apex/LwcRestSession.getRestSessionId';
import axiosLib from './axios';

export default class AxiosUtility {
  axios;

  async retrieveSessionData() {
    // retrieve SessionIds and BaseURL through Apex
    const [baseUrl, restSessionId] = await Promise.all([
      getBaseUrl(),
      getRestSessionId(),
    ]);
    this.baseUrl = baseUrl;
    this.restSessionId = restSessionId;
    // create axios instance, to be used for REST Calls
    this.axios = axiosLib.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.restSessionId}`,
      },
    });
  }

  sendPostRequest(resource, body, config) {
    const response = this.axios.post(
      resource,
      body,
      config,
    );
    return response;
  }
}