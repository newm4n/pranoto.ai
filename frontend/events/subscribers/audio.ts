import { exec } from "node:child_process";
import { promisify } from "node:util";
import { downloadFile, uploadFile } from "@/services/object-storage";
import { updateStatus } from "@/services/video/repository";
import { VideoStatus } from "@prisma/client";

const execPromisify = promisify(exec);

type OnAudioUploadParams = {
  id: string;
  objectStorageName: string;
};

export async function onAudioUpload({
  id,
  objectStorageName,
}: OnAudioUploadParams): Promise<void> {
  const fileName =
    objectStorageName.split("/")[objectStorageName.split("/").length - 1];
  const fileNameWithoutFormat = fileName.split(".")[0];
  const destinationFSPath = `/tmp/${fileName}`;

  await updateStatus(id, VideoStatus.TRANSCRIBING);

  console.info(
    `Audio ${objectStorageName} downloading to ${destinationFSPath}`
  );
  await downloadFile({
    destinationFSPath,
    objectStorageName,
  });
  console.info(`Audio ${objectStorageName} downloaded to ${destinationFSPath}`);

  const outputFSPath = `/tmp/${fileNameWithoutFormat}.json`;
  console.info(`Audio ${destinationFSPath} transcribing to ${outputFSPath}`);
  await transcribeAudio({
    audioFSPath: destinationFSPath,
  });
  console.info(`Audio ${destinationFSPath} transcribed to ${outputFSPath}`);

  const transcriptionObjectStorageName = `/texts/${fileNameWithoutFormat}.json`;
  console.info(
    `Text ${outputFSPath} uploading to ${transcriptionObjectStorageName}`
  );
  await uploadFile({
    objectStorageName: transcriptionObjectStorageName,
    targetFSPath: outputFSPath,
  });
  console.info(
    `Text ${outputFSPath} uploaded to ${transcriptionObjectStorageName}`
  );

  // TODO: insert transcription to database
  await updateStatus(id, VideoStatus.TRANSCRIBED);
  // TODO: delete all temporary FS data
}

type TranscribeAudioParams = {
  audioFSPath: string;
  modelSize?: "tiny" | "base" | "small" | "medium" | "large";
};

async function transcribeAudio({
  audioFSPath,
  modelSize = "tiny",
}: TranscribeAudioParams): Promise<void> {
  const cmd = `whisper ${audioFSPath} --model ${modelSize} --output_format json --output_dir /tmp`;
  console.info(`Audio Run: ${cmd}`);

  await execPromisify(cmd);
}
