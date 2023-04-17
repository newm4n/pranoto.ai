// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { spawn } from "child_process";

type Data = {
  name: string;
};

const ffmpeg = createFFmpeg({ log: true });

// TODO: make the path dynamic
const videoPath = `./public/videos/video.mov`;
const audioPath = `./public/audios/audio.mp3`;

// TODO: extract to helper function for reusable
async function convertVideoToAudio() {
  await ffmpeg.load();
  ffmpeg.FS("writeFile", "temp.mov", await fetchFile(videoPath));
  await ffmpeg.run("-i", "temp.mov", "-b:a", "192K", "-vn", "temp.mp3");
  await fs.promises.writeFile(audioPath, ffmpeg.FS("readFile", "temp.mp3"));
}

// TODO: extract to helper function for reusable
async function transcribeAudio() {
  const args = [
    "public/audios/audio.mp3",
    "--model",
    "base.en",
    "--language",
    "en",
    "--output_dir",
    "public/texts",
    "--output_format",
    "json",
    "--fp16",
    "False",
  ];
  const process = spawn("whisper", args);

  process.stdout.on("data", (data) => {
    console.log(`stdout: ${data}`);
  });

  process.stderr.on("data", (data) => {
    console.log(`stderr: ${data}`);
  });

  process.on("error", (error) => {
    console.log(`error: ${error.message}`);
  });

  process.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    await convertVideoToAudio();
    await transcribeAudio();
  } catch (error) {
    console.error(error);
    res.status(400).json({ name: "Failed" });
  }

  res.status(200).json({ name: "Success" });
}
