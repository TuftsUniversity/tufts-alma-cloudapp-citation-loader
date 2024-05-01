
function handleUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = e.target.result;
            const workbook = XLSX.read(data, {type: 'binary'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            sendToServer(json);
        };
        reader.readAsBinaryString(file);
    }
}

function sendToServer(data) {
    fetch('api.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(results => {
        var workbook = new Excel.Workbook();   
        let file = 'output.xlsx'
        let finalHeaders = ['Title', 'Author', 'Publisher', 'Date', 'MMS ID', 'ISBN', 'Version'];
        var sheet = workbook.addWorksheet('Results');
        sheet.addRow(finalHeaders);
		if (results['docs'].length > 0) {
                let data = new Array();
				results['docs'].forEach((result) => {
					
					
					let title, author, publisher, date, mms_id, isbn, version;

                    if ('title' in result['pnx']['display']){
                        title = result['pnx']['display']['title'][0];

                    }

                    if ('au' in result['pnx']['addata'] ){
                        author = result['pnx']['addata']['au'][0];
                        
                    }

                    if ('publisher' in result['pnx']['display']){
                        publisher = result['pnx']['display']['publisher'][0];
                    }

                    if ('date' in result['pnx']['addata']){
                        date = result['pnx']['addata']['date'][0];
                    }
					
				    if ('mms' in result['pnx']['display']){
                        
                        mms_id = result['pnx']['display']['mms'][0];

                 }

                    if ('isbn' in result['pnx']['addata']){
					    isbn = result['pnx']['addata']['isbn'][0];

                    }

                    if ('version' in result['pnx']['display']){
                        version = result['pnx']['display']['version'][0];

                    }
					
					let row = {'Title': title, 'Author': author, 'Publisher': publisher, 'Date': date, 'MMS ID': mms_id, 'ISBN': isbn, 'Version': version};
					sheet.addRow(row);
});
		}

        workbook.xlsx.writeFile(file)
       .then(function() {
           console.log('Array added and then file saved.')
       });
        
        document.getElementById('downloadBtn').style.display = 'block';
    })
    .catch(error => console.error('Error:', error));
}