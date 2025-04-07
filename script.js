/*--------------------- script.js ----------------------*/
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const selectButton = document.getElementById('select-button');
    const resultsDiv = document.getElementById('results');
    const metadataOutput = document.getElementById('metadata-output');
    const copyButton = document.getElementById('copy-button');
    const deleteButton = document.getElementById('delete-button');
    const imagePreview = document.getElementById('image-preview');
    const statusMessage = document.getElementById('status-message');

    let currentFile = null;
    let currentImageDataString = null; // Store the base64 string for piexif

    // --- Event Listeners ---

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Clicking anywhere in the drop zone triggers file input
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // File Selection Button (now redundant with above, but kept for compatibility)
    selectButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the dropZone click
        fileInput.click(); 
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Action Buttons
    copyButton.addEventListener('click', copyMetadata);
    deleteButton.addEventListener('click', removeMetadataAndDownload);

    // --- Core Functions ---

    function handleFile(file) {
        if (!file || file.type !== 'image/jpeg') {
            showStatus('Please select a JPEG image file.', 'error');
            resetUI();
            return;
        }
        currentFile = file;
        resultsDiv.style.display = 'none'; // Hide previous results
        showStatus('Processing image...', 'info');

        const reader = new FileReader();

        reader.onload = function (e) {
            // For piexifjs, we need the base64 string representation
            currentImageDataString = e.target.result;

            // Display image preview
            imagePreview.src = currentImageDataString;
            imagePreview.style.display = 'block';

            displayMetadata(currentImageDataString);
        };

        reader.onerror = function () {
            showStatus('Error reading file.', 'error');
            resetUI();
        };

        // Read the file as a data URL (base64 encoded)
        reader.readAsDataURL(file);
    }

    function displayMetadata(imageDataString) {
         // Ensure piexif is loaded
        if (typeof piexif === 'undefined') {
             showStatus('Error: piexif.js library not loaded.', 'error');
             resetUI();
             return;
        }

        try {
            const exifData = piexif.load(imageDataString);
            let outputString = '';
            let hasExif = false;

            for (const ifd in exifData) {
                if (ifd === 'thumbnail') { // Often binary, skip detailed view
                    if (exifData[ifd] !== null) {
                         outputString += `--- Thumbnail Data ---\n  (Binary data present)\n\n`;
                         hasExif = true;
                    }
                    continue;
                }

                if (Object.keys(exifData[ifd]).length > 0) {
                     hasExif = true;
                     outputString += `--- ${ifd} IFD ---\n`;
                     for (const tag in exifData[ifd]) {
                         const tagName = piexif.TAGS[ifd][tag]?.name || `UnknownTag${tag}`;
                         let tagValue = exifData[ifd][tag];

                         // Try to decode byte strings (simple approach)
                         if(tagValue instanceof Uint8Array || tagValue instanceof ArrayBuffer) {
                            try {
                                tagValue = new TextDecoder("utf-8", { fatal: false }).decode(tagValue);
                            } catch {
                                tagValue = `(Binary data length: ${tagValue.byteLength || tagValue.length})`;
                            }
                         } else if (typeof tagValue === 'object' && tagValue !== null) {
                             tagValue = JSON.stringify(tagValue); // Show objects/arrays as JSON
                         }

                         // Limit long string display
                         if (typeof tagValue === 'string' && tagValue.length > 200) {
                            tagValue = tagValue.substring(0, 200) + '... (truncated)';
                         }

                         outputString += `  ${tagName} (${tag}): ${tagValue}\n`;
                     }
                     outputString += '\n'; // Add space between IFDs
                }
            }

            // Add file info that we can determine
            outputString += `--- Basic File Info ---\n`;
            outputString += `  Filename: ${currentFile.name}\n`;
            outputString += `  File Size: ${formatFileSize(currentFile.size)}\n`;
            outputString += `  File Type: ${currentFile.type}\n\n`;

            if (hasExif) {
                metadataOutput.textContent = outputString;
                resultsDiv.style.display = 'block';
                showStatus('Metadata extracted successfully.', 'success');
            } else {
                metadataOutput.textContent = outputString + 'No EXIF metadata found in this image.';
                resultsDiv.style.display = 'block'; // Show the result area even if empty
                showStatus('No EXIF metadata found.', 'info');
            }

        } catch (error) {
            console.error('Error loading EXIF data:', error);
            metadataOutput.textContent = `Error reading EXIF data: ${error.message}`;
            resultsDiv.style.display = 'block';
            showStatus('Error reading metadata.', 'error');
        }
    }

    // Format file size in KB, MB, etc.
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function copyMetadata() {
        if (!metadataOutput.textContent || metadataOutput.textContent === 'No EXIF metadata found in this image.' || metadataOutput.textContent.startsWith('Error')) {
            showStatus('No metadata to copy.', 'error');
            return;
        }

        navigator.clipboard.writeText(metadataOutput.textContent)
            .then(() => {
                showStatus('Metadata copied to clipboard!', 'success');
                // Optional: Visual feedback on button
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                setTimeout(() => { copyButton.textContent = originalText; }, 1500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                showStatus('Failed to copy metadata.', 'error');
            });
    }

    function removeMetadataAndDownload() {
        if (!currentImageDataString) {
             showStatus('No image loaded to process.', 'error');
            return;
        }
         // Ensure piexif is loaded
        if (typeof piexif === 'undefined') {
             showStatus('Error: piexif.js library not loaded.', 'error');
             return;
        }

        try {
            // Show status before processing
            showStatus('Processing image...', 'info');
            
            // Remove EXIF data
            const newDataString = piexif.remove(currentImageDataString);

            // Convert base64 data URL back to a Blob for download
            const blob = dataURLtoBlob(newDataString);

            if (!blob) {
                throw new Error("Could not convert processed data to Blob.");
            }

            // Create download link
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;

            // Create filename (e.g., original_name_noexif.jpg)
            const baseName = currentFile.name.substring(0, currentFile.name.lastIndexOf('.')) || currentFile.name;
            link.download = `${baseName}_noexif.jpg`;

            // Trigger download
            document.body.appendChild(link); // Required for Firefox
            link.click();

            // Clean up
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showStatus('Image downloaded without metadata.', 'success');

        } catch (error) {
            console.error('Error removing metadata or downloading:', error);
            showStatus(`Error processing image: ${error.message}`, 'error');
        }
    }

    // --- Utility Functions ---

    function resetUI() {
        resultsDiv.style.display = 'none';
        metadataOutput.textContent = '';
        imagePreview.src = '#'; // Clear preview
        imagePreview.style.display = 'none';
        currentFile = null;
        currentImageDataString = null;
        fileInput.value = ''; // Reset file input
    }

    function showStatus(message, type = 'info') { // type: 'info', 'success', 'error'
         statusMessage.textContent = message;
         statusMessage.className = `status ${type}`; // Apply class for styling
    }

    // Helper to convert Data URL to Blob
    function dataURLtoBlob(dataurl) {
        try {
            const arr = dataurl.split(',');
            if (arr.length < 2) return null; // Invalid format

            const mimeMatch = arr[0].match(/:(.*?);/);
            if (!mimeMatch || mimeMatch.length < 2) return null; // Cant find mime type
            const mime = mimeMatch[1];

            const bstr = atob(arr[1]); // Decode base64
            let n = bstr.length;
            const u8arr = new Uint8Array(n); // Create Uint8Array

            while(n--){
                u8arr[n] = bstr.charCodeAt(n); // Populate array
            }
            return new Blob([u8arr], {type:mime});
        } catch (e) {
            console.error("Error converting data URL to Blob:", e);
            return null;
        }
    }
});