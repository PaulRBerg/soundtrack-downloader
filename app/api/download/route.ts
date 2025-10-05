import { PassThrough } from "node:stream";
import ffmpeg from "fluent-ffmpeg";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { create as createYoutubeDl } from "youtube-dl-exec";

// Set ffmpeg path from environment or use system default
const ffmpegPath =
  process.env.FFMPEG_PATH ||
  (process.platform === "darwin" ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

// Set yt-dlp path from environment or use system default
const ytDlpPath =
  process.env.YT_DLP_PATH ||
  (process.platform === "darwin" ? "/opt/homebrew/bin/yt-dlp" : "yt-dlp");

// Create youtube-dl instance with custom binary path
const youtubedl = createYoutubeDl(ytDlpPath);

type RequestBody = {
  endTime: number;
  optimizeLoop?: boolean;
  startTime: number;
  url: string;
};

type YoutubeDlResponse = {
  title?: string;
  duration?: number;
};

function isValidYouTubeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    return (
      (hostname === "www.youtube.com" ||
        hostname === "youtube.com" ||
        hostname === "youtu.be" ||
        hostname === "m.youtube.com") &&
      (parsedUrl.searchParams.has("v") || hostname === "youtu.be")
    );
  } catch {
    return false;
  }
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 200);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const { endTime, optimizeLoop = false, startTime, url } = body;

    // Validate YouTube URL
    if (!url || !isValidYouTubeUrl(url)) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // Validate time range
    if (
      typeof startTime !== "number" ||
      typeof endTime !== "number" ||
      startTime < 0 ||
      endTime <= startTime
    ) {
      return NextResponse.json(
        {
          error: "Invalid time range. startTime must be >= 0 and endTime must be > startTime",
        },
        { status: 400 },
      );
    }

    const duration = endTime - startTime;

    // Validate minimum duration for loop optimization
    if (optimizeLoop && duration < 1) {
      return NextResponse.json(
        {
          error: "Loop optimization requires segment duration of at least 1 second",
        },
        { status: 400 },
      );
    }

    // Get video info using yt-dlp
    let videoInfo: { title?: string; duration?: number };
    try {
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        extractorArgs: "youtube:player_client=android",
        noCheckCertificates: true,
        noWarnings: true,
        // biome-ignore lint/suspicious/noExplicitAny: extractorArgs not available in type definitions
      } as any);

      // youtube-dl-exec returns an object with video metadata
      if (typeof info === "object" && info !== null) {
        const ytResponse = info as YoutubeDlResponse;
        videoInfo = {
          duration: ytResponse.duration,
          title: ytResponse.title,
        };
      } else {
        throw new Error("Invalid response from yt-dlp");
      }
    } catch (error) {
      console.error("Video info fetch error:", error);
      return NextResponse.json({ error: "Video not found or unavailable" }, { status: 404 });
    }

    const videoTitle = videoInfo.title || "video";
    const videoDuration = videoInfo.duration || 0;

    // Validate time range against video duration
    if (endTime > videoDuration) {
      return NextResponse.json(
        {
          error: `End time (${endTime}s) exceeds video duration (${videoDuration}s)`,
        },
        { status: 400 },
      );
    }

    // Set response headers for file download
    const loopSuffix = optimizeLoop ? "_loop" : "";
    const filename = `${sanitizeFilename(videoTitle)}_${startTime}-${endTime}${loopSuffix}.mp3`;
    const headers = new Headers({
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "audio/mpeg",
    });

    // Use yt-dlp to stream audio to stdout and pipe to ffmpeg
    const ytdlpProcess = youtubedl.exec(url, {
      extractorArgs: "youtube:player_client=android",
      format: "bestaudio/best",
      output: "-", // Output to stdout
      // biome-ignore lint/suspicious/noExplicitAny: extractorArgs not available in type definitions
    } as any);

    if (!ytdlpProcess.stdout) {
      return NextResponse.json({ error: "Failed to get audio stream" }, { status: 500 });
    }

    // Store stdout in a variable for TypeScript
    const audioStream = ytdlpProcess.stdout;

    if (optimizeLoop) {
      // Use FFmpeg to extract segment and apply crossfade for seamless looping
      return new Promise<NextResponse>((resolve, reject) => {
        const passThrough = new PassThrough();
        const fadeOutStart = duration - 0.05;

        const command = ffmpeg(audioStream)
          .inputOptions([`-ss ${startTime}`, `-t ${duration}`])
          .audioFilters([`afade=t=in:st=0:d=0.05,afade=t=out:st=${fadeOutStart}:d=0.05`])
          .format("mp3")
          .audioCodec("libmp3lame")
          .audioBitrate(320)
          .on("start", (commandLine) => {
            console.log("FFmpeg command:", commandLine);
          })
          .on("error", (error) => {
            console.error("FFmpeg error:", error);
            ytdlpProcess.kill();
            passThrough.destroy();
            reject(
              NextResponse.json(
                { error: "Failed to process audio with loop optimization" },
                { status: 500 },
              ),
            );
          })
          .on("end", () => {
            console.log("FFmpeg processing complete");
          });

        command.pipe(passThrough);

        // Convert Node.js stream to Web ReadableStream
        const readableStream = new ReadableStream({
          cancel() {
            command.kill("SIGKILL");
            ytdlpProcess.kill();
            passThrough.destroy();
          },
          async start(controller) {
            passThrough.on("data", (chunk: Buffer) => {
              controller.enqueue(new Uint8Array(chunk));
            });

            passThrough.on("end", () => {
              controller.close();
            });

            passThrough.on("error", (error: Error) => {
              console.error("Stream error:", error);
              controller.error(error);
            });
          },
        });

        resolve(new NextResponse(readableStream, { headers }));
      });
    }

    // Extract segment without loop optimization
    return new Promise<NextResponse>((resolve, reject) => {
      const passThrough = new PassThrough();

      const command = ffmpeg(audioStream)
        .inputOptions([`-ss ${startTime}`, `-t ${duration}`])
        .format("mp3")
        .audioCodec("libmp3lame")
        .audioBitrate(320)
        .on("start", (commandLine) => {
          console.log("FFmpeg command:", commandLine);
        })
        .on("error", (error) => {
          console.error("FFmpeg error:", error);
          ytdlpProcess.kill();
          passThrough.destroy();
          reject(NextResponse.json({ error: "Failed to process audio segment" }, { status: 500 }));
        })
        .on("end", () => {
          console.log("FFmpeg processing complete");
        });

      command.pipe(passThrough);

      // Convert Node.js stream to Web ReadableStream
      const readableStream = new ReadableStream({
        cancel() {
          command.kill("SIGKILL");
          ytdlpProcess.kill();
          passThrough.destroy();
        },
        async start(controller) {
          passThrough.on("data", (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });

          passThrough.on("end", () => {
            controller.close();
          });

          passThrough.on("error", (error: Error) => {
            console.error("Stream error:", error);
            controller.error(error);
          });
        },
      });

      resolve(new NextResponse(readableStream, { headers }));
    });
  } catch (error) {
    console.error("Download error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error during download" }, { status: 500 });
  }
}
