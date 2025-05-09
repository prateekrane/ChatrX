import * as Bytescale from "@bytescale/sdk";
import * as FileSystem from 'expo-file-system';

const uploadManager = new Bytescale.UploadManager({
    apiKey: "public_223k29C8zHH8eBkMjmFmwVeyPc1F"
});

const uploadToByteScale = async (fileUri) => {
    try {
        if (!fileUri) {
            throw new Error('No file URI provided');
        }

        // Read the file as blob
        const response = await fetch(fileUri);
        const blob = await response.blob();

        const result = await uploadManager.upload({
            data: blob,
            mime: "image/jpeg",
            originalFileName: `profile_${Date.now()}.jpg`,
            onProgress: ({ progress }) => console.log('Upload progress:', progress)
        });

        console.log('Bytescale upload successful:', result);

        // Return the complete response
        return result;

    } catch (error) {
        console.error('Bytescale upload error:', error);
        throw new Error('Failed to upload to Bytescale: ' + error.message);
    }
};

export { uploadToByteScale };
