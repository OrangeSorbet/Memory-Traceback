var window = self;

self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/oboe.js/2.1.5/oboe-browser.min.js');

self.onmessage = function(e) {
    const { file, importType } = e.data;
    console.log(`✅ Worker received file: ${file.name}, Type: ${importType}`);

    if (!file || !self.oboe) {
        console.error('❌ Worker is missing the file or Oboe.js library.');
        self.postMessage({ type: 'error', message: 'Worker is missing the file or Oboe.js library.' });
        return;
    }

    let batch = [];
    const BATCH_SIZE = 1000;
    let totalItems = 0;

    const postBatch = () => {
        if (batch.length > 0) {
            console.log(`📦 Worker sending batch of ${batch.length} items to the main thread.`);
            self.postMessage({ type: 'data', payload: batch, importType: importType });
            batch = [];
        }
    };
    
    oboe(URL.createObjectURL(file))
        .node('{key}', (item, path) => {
            if (item && typeof item === 'object') {
                const key = path[0];
                
                if (importType === 'single_file') {
                    item.dataType = (key === 'timeline') ? 'timeline' : 'secretPhotos';
                }

                batch.push(item);
                totalItems++;

                if (batch.length >= BATCH_SIZE) {
                    postBatch();
                }
            }
            return oboe.drop;
        })
        .done(() => {
            postBatch(); // Send any remaining items
            console.log(`🎉 Worker finished parsing. Total items: ${totalItems}`);
            self.postMessage({ type: 'done', total: totalItems, importType: importType });
        })
        .fail((err) => {
            console.error('❌ Worker failed to parse file:', err);
            self.postMessage({ type: 'error', message: 'Oboe.js failed to parse the file.', details: err });
        });
};