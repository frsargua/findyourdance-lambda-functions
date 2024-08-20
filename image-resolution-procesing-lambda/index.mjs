import AWS from "aws-sdk";
import Sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const S3 = new AWS.S3();

//TODO: Add logger package
export const handler = async (event) => {
  const resolutions = [
    { width: 1280, height: 720, folder: "images/formatted/1280x720" },
    { width: 1920, height: 1080, folder: "images/formatted/1920x1080" },
    { width: 3840, height: 2160, folder: "images/formatted/3840x2160" },
  ];

  try {
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(
      event.Records[0].s3.object.key.replace(/\+/g, " ")
    );

    // Check if the file is in the original folder
    const originalFolder = "images/original/";

    // Skip if the file is not in the original folder
    if (!key.startsWith(originalFolder)) {
      console.log("Skipping file ${key} as it's not in the original folder.");
      return { status: "Skipping folder" };
    }

    const image = await getImageFromS3(bucket, key);
    const originalFileName = key.split("/").pop();
    const uuid = uuidv4();

    await processAndSaveImages(
      bucket,
      image.Body,
      originalFileName,
      uuid,
      resolutions
    );

    console.log(`Image processing completed for: ${key}`);
    return { status: "Image processed" };
  } catch (error) {
    console.error(`Error processing image: ${error}`);
    return { status: "Error processing image" };
  }
};

const getImageFromS3 = async (bucket, key) => {
  try {
    return await S3.getObject({ Bucket: bucket, Key: key }).promise();
  } catch (error) {
    throw new Error(`Failed to get image from S3: ${error}`);
  }
};

const processAndSaveImages = async (
  bucket,
  imageBody,
  originalFileName,
  uuid,
  resolutions
) => {
  await Promise.all(
    resolutions.map(async (resolution) => {
      try {
        const resizedImage = await resizeImage(imageBody, resolution);
        await saveImageToS3(
          bucket,
          resizedImage,
          resolution.folder,
          uuid,
          originalFileName
        );
      } catch (error) {
        console.error(
          `Failed to process and save image for resolution ${resolution.width}x${resolution.height}: ${error}`
        );
      }
    })
  );
};

const resizeImage = (imageBody, resolution) => {
  return Sharp(imageBody)
    .resize({
      width: resolution.width,
      height: resolution.height,
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .toBuffer();
};

const saveImageToS3 = async (
  bucket,
  imageBuffer,
  folder,
  uuid,
  originalFileName
) => {
  const newKey = `${folder}/${uuid}.jpg`;
  try {
    await S3.putObject({
      Bucket: bucket,
      Key: newKey,
      Body: imageBuffer,
      ContentType: "image/*",
      Metadata: { originalFileName },
    }).promise();
    console.log(`Successfully saved resized image: ${newKey}`);
  } catch (error) {
    throw new Error(`Failed to save image to S3: ${error}`);
  }
};
