const axios = require('axios').default;

class vROps {

    #fqdn;
    #username;
    #password;
    #token;

    constructor(fqdn, username, password) {
        this.#fqdn = fqdn;
        this.#username = username;
        this.#password = password;
    }

    async acquireToken() {

        const url = `${this.#fqdn}/suite-api/api/auth/token/acquire`

        let requestBody = {
            authSource: "local",
            username: this.#username,
            password: this.#password,
        }

        let response = await axios.post(url, requestBody, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });

        this.#token = response.data.token;
    }

    async makeRequest(fn) {

        try {
            return await fn();
        } catch (e) {
            await this.acquireToken();
            return await fn();
        }

    }

    getAxiosConfiguration() {
        return {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `vRealizeOpsToken ${this.#token}`
            }
        }
    }

    async createAirQualityMonitoringStation(name) {

        const adapterKindKey = `MonitoringStation`
        const url = `${this.#fqdn}/suite-api/api/resources/adapterkinds/${adapterKindKey}`

        const data = {
            "description": "Air Quality Monitoring Station",
            "creationTime": null,
            "resourceKey": {
                "name": name,
                "adapterKindKey": adapterKindKey,
                "resourceKindKey": "AirQualityMonitoringStation"
            },
            "resourceStatusStates": [],
            "dtEnabled": true,
            "monitoringInterval": 5
        }

        const response = await this.makeRequest(async () => {
            return axios.post(url, data, this.getAxiosConfiguration());
        })

        this.sendMetrics(
            response.data.identifier,
            JSON.parse('{"property-content":[{"statKey":"CustomMetrics|StandardConcentration|PM1.0","timestamps":[1590597600],"values":[0],"others":[],"otherAttributes":{}},{"statKey":"CustomMetrics|StandardConcentration|PM2.5","timestamps":[1590597600],"values":[0],"others":[],"otherAttributes":{}},{"statKey":"CustomMetrics|StandardConcentration|PM10","timestamps":[1590597600],"values":[0],"others":[],"otherAttributes":{}},{"statKey":"CustomMetrics|AtmosphericConcentration|PM1.0","timestamps":[1590597600],"values":[0],"others":[],"otherAttributes":{}},{"statKey":"CustomMetrics|AtmosphericConcentration|PM2.5","timestamps":[1590597600],"values":[0],"others":[],"otherAttributes":{}},{"statKey":"CustomMetrics|AtmosphericConcentration|PM10","timestamps":[1590597600],"values":[0],"others":[],"otherAttributes":{}}]}')
        )

        return response.data.identifier;
    }

    async sendMetrics(uid, metrics) {
        const url = `${this.#fqdn}/suite-api/api/resources/${uid}/properties`

        const response = await this.makeRequest(async () => {
            return axios.post(url, metrics, this.getAxiosConfiguration());
        })
    }
}

module.exports = vROps
