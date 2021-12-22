const express = require('express');
const fs = require('fs');
const app = express()
const port = 12345
const index_file_path = './public/index.html';
const data_file_path = '../data.json';

app.get('/', function(req, res) {
    fs.readFile(index_file_path, 'utf-8', function(err, indexHtml) {
        if (err) {
            res.send(404);
        } else {
            // Load data
            let rawData = fs.readFileSync(data_file_path);
            let parsedData = JSON.parse(rawData);
            let chartLabels = [];
            let chartDatasets = [];
            let classementJeunesse = [];

            // Parse the list of jeunesse
            for (const jeunesse of Object.keys(parsedData)) {
                let r = randomIntFromInterval(0, 255);
                let g = randomIntFromInterval(0, 255);
                let b = randomIntFromInterval(0, 255);
                let rgb = `rgb(${r},${g},${b})`;
                let dataset = {
                    label: parsedData[jeunesse].instagram_account[0],
                    data: [],
                    tempData: [],
                    fill: false,
                    borderColor: rgb,
                    tension: 0.1
                };

                classementJeunesse.push({
                    url : dataset.label,
                    value : parseInt(parsedData[jeunesse].checks.at(-1)['likes'].replace(' ', ''))
                });

                // for each jeunesse, parse their checks
                parsedData[jeunesse].checks.forEach(check => {
                    // Labels
                    let date = new Date(check.timestamp);
                    let hours = date.getHours();
                    let min = date.getMinutes();
                    let day = date.getDate();
                    let month = date.getMonth() + 1;
                    let year = date.getFullYear();
                    let label = day + "." + month + "." + year + " " + hours + "h" + (min - (min % 10)) + "m";
                    chartLabels.indexOf(label) === -1 ? chartLabels.push(label) : undefined;

                    // Data
                    if (!dataset.tempData[label]) {
                        dataset.tempData[label] = [];
                    }
                    dataset.tempData[label].push(String(check.likes).replace(' ', ''));
                });

                chartDatasets.forEach(dataset => {
                    let data = [];
                    for (let i = 0; i < chartLabels.length; i++) {
                        const label = chartLabels[i];
                        if (dataset.tempData[label]) {
                            let tot = dataset.tempData[label].reduce((acc, current) => {
                                return parseInt(acc) + parseInt(current);
                            }, 0.0);
                            let avg = tot / dataset.tempData[label].length;
                            data.push(avg);
                        } else {
                            if (dataset.tempData[chartLabels[i - 1]]) {
                                data.push(dataset.tempData[chartLabels[i - 1]]);
                            } else if (data[data.length - 1]) {
                                data.push(data[data.length - 1]);
                            } else {
                                data.push(null);
                            }
                        }
                    }
                    dataset.data = data;
                });
                chartDatasets.push(dataset);
            };

            // Classement
            classementJeunesse.sort(function (a, b) {
                return b.value - a.value;
            });

            let classement = "";
            classementJeunesse.forEach(jeunesse => {
                classement += `<li>${jeunesse.url} : ${jeunesse.value}`;
            });

            chartLabels.sort();


            indexHtml = indexHtml.replace('{{chart_labels}}', JSON.stringify(chartLabels))
                .replace('{{chart_datasets}}', JSON.stringify(chartDatasets))
                .replace('{{classement}}', classement);
            res.send(indexHtml);
        }
    });
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}
