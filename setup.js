const fs = require('fs');
const inquirer = require('inquirer');
const chalk = require('chalk');
const vROps = require('./vrops');

console.log(chalk.green('Setting up monitoring station...'));
console.log('Please provide information required to setup device and create vROps resource');

inquirer
    .prompt([
        {
            name: 'vROps_fqdn',
            message: 'vROps URL:',
            default: 'https://vrops.ajablonski.pro',
        },
        {
            name: 'vROps_username',
            message: 'vROps username:',
            default: 'api',
        },
        {
            name: 'vROps_password',
            type: 'password',
            message: 'vROps password:'
        },
        {
            name: 'prefix',
            message: 'Station city prefix:'
        },
        {
            name: 'number',
            message: 'Station number:',
            type: 'number'
        },
        {
            name: 'confirmation',
            message: 'Is all provided information correct?',
            type: 'confirm'
        },
    ])
    .then(async answers => {

        if (!answers.confirmation) {
            console.log(chalk.yellow(`Aborting...`));
            process.exit();
        }

        const instance = new vROps(
            answers.vROps_fqdn,
            answers.vROps_username,
            answers.vROps_password
        );

        try {
            console.log(chalk.blueBright(`Connecting to vROps`));
            await instance.acquireToken();
        } catch (e) {
            console.log(chalk.red('Could not connect to vROps instance'));
            console.log(chalk.yellow(`Aborting...`));
            process.exit();
        }

        let UID;
        let num = answers.number;
        if (num < 10) num = `0${num}`;

        const name = `AQ-${answers.prefix}-${num}`;

        try {
            console.log(chalk.blueBright(`Creating vROps resource ${name}`));

            UID = await instance.createAirQualityMonitoringStation(name);
        } catch (e) {
            console.log(chalk.red('Could not create vROps resource'));
            console.log(chalk.yellow(`Aborting...`));
            process.exit();
        }

        console.log(chalk.green(`Created resource ${name}. UID: ${UID}`));

        inquirer
            .prompt([{
                name: 'save',
                message: 'Save to .env file?',
                type: 'confirm'
            }])
            .then(async ans => {
                if (!ans.save) {
                    process.exit();
                }

                fs.writeFileSync(
                    `${__dirname}/.env`,
                    `vROps_uid="${UID}"\nvROps_fqdn="${answers.vROps_fqdn}"\nvROps_username="${answers.vROps_username}"\nvROps_password="${answers.vROps_password}"\n`
                );

            })
            .catch(e => {
                console.log(chalk.red(`Could not save to .env file...`));
                console.log(e);
            });

    })
    .catch(e => {
        console.log(chalk.red(`Fatal error...`));
    });
