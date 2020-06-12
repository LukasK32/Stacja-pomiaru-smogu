const SerialPort = require('serialport');
const chalk = require('chalk');
const vROps = require('./vrops');

// Load variables from .env file
require('dotenv').config();

function readPMS(buff) {
    if (buff[0] !== 0x42 || buff[1] !== 0x4d) {
        throw new Error('Malformed data (start characters incorrect)');
    }

    let checksum = (buff[30] << 8) + buff[31];

    for (let i = 0; i < 30; i++) {
        checksum -= buff[i];
    }

    if (checksum !== 0) {
        throw new Error('Incorrect checksum!')
    }

    const Data = [];

    for (let i = 1; i <= 12; i++) {
        Data.push(
            buff.readInt16BE(2 + (2 * i))
        );
    }

    return Data;
}

async function main() {

    console.log(chalk.green('Initialization...'));

    const instance = new vROps(
        process.env.vROps_fqdn,
        process.env.vROps_username,
        process.env.vROps_password,
    );

    try {
        await instance.acquireToken();
    } catch (e) {
        console.log('Could not acquire vROps token');
        return;
    }

    let combinedData = [];

    const PMS = new SerialPort('/dev/ttyUSB0', {
        baudRate: 9600
    });

    PMS.on('error', (e) => {
        console.log(chalk.red('Error while connecting to PMS7003. Aborting...'))
        console.log(e);
        process.exit();
    })

    PMS.on('data', (buffer) => {

        try {
            const measurement = readPMS(buffer);
            combinedData.push(measurement);
            console.log(`[${chalk.blue('PMS7003')}] Measurement: `, JSON.stringify(measurement));
        } catch (e) {
            console.log(chalk.yellow('Could not read serial data from PMS7003. Skipping...'))
        }

    })

    setInterval(async () => {

        const CustomMetrics = [
            'CustomMetrics|StandardConcentration|PM1.0',
            'CustomMetrics|StandardConcentration|PM2.5',
            'CustomMetrics|StandardConcentration|PM10',
            'CustomMetrics|AtmosphericConcentration|PM1.0',
            'CustomMetrics|AtmosphericConcentration|PM2.5',
            'CustomMetrics|AtmosphericConcentration|PM10',
            'CustomMetrics|Particles|Quantity0.3',
            'CustomMetrics|Particles|Quantity0.5',
            'CustomMetrics|Particles|Quantity1.0',
            'CustomMetrics|Particles|Quantity2.5',
            'CustomMetrics|Particles|Quantity5.0',
            'CustomMetrics|Particles|Quantity10',
        ];

        const Metrics = {};

        CustomMetrics.forEach((metric) => {
            Metrics[metric] = 0;
        });

        combinedData.forEach((measurement) => {

            CustomMetrics.forEach((metric, index) => {
                Metrics[metric] += measurement[index];
            });

        });

        CustomMetrics.forEach((metric) => {
            Metrics[metric] /= combinedData.length;
            Metrics[metric] = Math.round(Metrics[metric])
        });

        // Reset
        combinedData = [];

        // Convert data to vROps JSON
        const vROpsMetrics = {
            "property-content": []
        };

        const UnixTimeStamp = Math.round((new Date()).getTime() / 1000);

        CustomMetrics.forEach((metric) => {
            vROpsMetrics["property-content"].push({
                "statKey": metric,
                "timestamps": [UnixTimeStamp],
                "values": [Metrics[metric]],
                "others": [],
                "otherAttributes": {}
            });
        });

        try {
            await instance.sendMetrics(process.env.vROps_uid, vROpsMetrics);
            console.log(chalk.green('Data sent to vROps'));
        } catch (e) {
            console.log(chalk.red('Could not send data to vROps!'));
        }

    }, 60000)

}

console.log("Waiting for full minute to start...")

const currentTime = new Date()
const startTime = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), currentTime.getHours(), currentTime.getMinutes() + 1, 0, 0);

setTimeout(main, startTime - currentTime);
