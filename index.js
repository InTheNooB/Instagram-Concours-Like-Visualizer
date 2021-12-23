const express = require('express');
const fs = require('fs');
const app = express()
const port = 12345
const index_file_path = './public/index.html';
const data_file_path = '../data.json';

// Handles GET request on "/"
app.get('/', function(req, res) {

    // Read the HTML template
    fs.readFile(index_file_path, 'utf-8', function(err, indexHtml) {
        // If an error occured while reading, return a 404 error to the client. 
        if (err) {
            res.send(404);
        } else {
            // If not, read the file containing the likes data   
            let rawData = fs.readFileSync(data_file_path);
            let parsedData = JSON.parse(rawData);

            // Defines some variables
            let chartLabels = [];
            let chartDatasets = [];
            let classementJeunesse = [];

            // Parses the list of jeunesse to create the list of labels and 
            // gather the number of like from each check
            for (const jeunesse of Object.keys(parsedData)) {

                // Generate a random color for the current jeunesse
                let r = randomIntFromInterval(0, 255);
                let g = randomIntFromInterval(0, 255);
                let b = randomIntFromInterval(0, 255);
                let rgb = `rgb(${r},${g},${b})`;

                // Define the dataset that will be inserted inside the HTML template
                let dataset = {
                    label: parsedData[jeunesse].instagram_account[0],
                    data: [],
                    tempData: [],
                    fill: false,
                    borderColor: rgb,
                    tension: 0.1
                };

                // Adds the current jeunesse to the classement
                classementJeunesse.push({
                    name: jeunesse,
                    url: dataset.label,
                    value: parseInt(parsedData[jeunesse].checks[parsedData[jeunesse].checks.length - 1]['likes'].replace(' ', ''))
                });

                // For each jeunesse, parse their checks, find the label using the timestamp,
                // add the label to the list of labels and the number of like inside an array
                // using the label as key. 
                parsedData[jeunesse].checks.forEach(check => {
                    // Generate label name using the check's timestamp 
                    let date = new Date(check.timestamp);
                    let hours = date.getHours();
                    let min = date.getMinutes();
                    let day = date.getDate();
                    let month = date.getMonth() + 1;
                    let year = date.getFullYear();

                    // Add the "0" before the number of minutes in case it is less than 10
                    let renderedMin = (min - (min % 10));
                    renderedMin = (renderedMin < 10 ? '0' : '') + renderedMin;

                    // Add the "0" before the number of hours in case it is less than 10
                    renderedHours = (hours < 10 ? '0' : '') + hours;

                    // Create and insert the label
                    let label = day + "." + month + "." + year + " " + renderedHours + "h" + renderedMin + "m";
                    chartLabels.push({ label: label, timestamp: check.timestamp });

                    // If the label isn't known as key of the array, create an array 
                    // as value using the label as key.
                    if (!dataset.tempData[label]) {
                        dataset.tempData[label] = [];
                    }

                    // Insert the number of likes inside an array using the label as key.
                    dataset.tempData[label].push(String(check.likes).replace(' ', ''));
                });

                // Once the dataset is done being created, push it inside the list of datasets.
                chartDatasets.push(dataset);
            };

            // Orders the labels using their timestamp
            chartLabels.sort((a, b) => {
                return a.timestamp - b.timestamp;
            });

            // Remove duplicates from the list of labels
            chartLabels = [...new Set(chartLabels.map(function(value) {
                return value.label;
            }))];


            /**
             *  As now, the list of datasets contains this structure :
             * chartDatasets : [
             *      {
             *          tempData: [
             *              '23.12.2021 13h30m' : ['88', '89'], 
             *              '23.12.2021 13h40m' : ['89'],
             *              '23.12.2021 13h50m' : ['90', '90'],
             *              '23.12.2021 14h00m' : ['91'],
             *          ],
             *          data: [],
             *          ...    
             *      }
             * ]
             * 
             * 
             * Parses the list of dataset to fill the array "data" inside each of them.
             * This array will contain the number of likes corresponding to the 
             * label (rightfully ordered). This is required because some dataset might miss
             * a check, which would shift all his data, so we add a value at this missing spot
             * to fill the gaps and be sure every data corresponds to the right label
             * */ 
            chartDatasets.forEach(dataset => {
                let data = [];
                
                // Parses the list of labels
                for (let i = 0; i < chartLabels.length; i++) {
                    const label = chartLabels[i];

                    if (dataset.tempData[label]) {
                    // If an array exists in the dataset using the label as key, 
                    // calculate the average number of likes of this array 
                    // and add it to the data array.
                        let tot = dataset.tempData[label].reduce((acc, current) => {
                            return parseInt(acc) + parseInt(current);
                        }, 0.0);
                        let avg = tot / dataset.tempData[label].length;
                        dataset.data.push(avg);
                    } else {
                        // If there's no array, check if there's one at the previous label
                        if (dataset.tempData[chartLabels[i - 1]]) {
                            // If it is the case, calculate the average number of likes of this array 
                            // and add it to the data array.
                            let tot = dataset.tempData[chartLabels[i - 1]].reduce((acc, current) => {
                                return parseInt(acc) + parseInt(current);
                            }, 0.0);
                            let avg = tot / dataset.tempData[chartLabels[i - 1]].length;
                            dataset.data.push(avg);
                        } else if (data[data.length - 1]) {
                            // If not, check if the data array contains a previous value,
                            // if it is the case, juste duplicate this value
                            dataset.data.push(data[data.length - 1]);
                        } else {
                            // Otherwise add an empty value.
                            dataset.data.push(null);
                        }
                    }
                }
            });

            // Sort the classement by their number of like
            classementJeunesse.sort(function(a, b) {
                return b.value - a.value;
            });

            // Create the element that will be inserted inside the template.
            // This element is a list of <li> tag containing the name of the jeunesse,
            // their number of likes and the difference of like from the last check
            let classement = "";
            classementJeunesse.forEach(jeunesse => {
                let diff = "";
                
                // If there is a last check, calculate the difference 
                if (parsedData[jeunesse.name].checks[parsedData[jeunesse.name].checks.length - 2]) {
                    let diff = parseInt(jeunesse.value) - parseInt(parsedData[jeunesse.name].checks[parsedData[jeunesse.name].checks.length - 2]['likes'].replace(' ', ''));
                    if (diff > 0) {
                        diff = "(+" + diff + ")";
                    } else if (diff < 0) {
                        diff = "(" + diff + ")";
                    }
                }
                classement += `<li>${jeunesse.url} : ${jeunesse.value} ${diff}</li>`;
            });

            // Insert the values inside the template
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
