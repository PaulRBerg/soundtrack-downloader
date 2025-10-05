"use client";

import { useId, useState } from "react";
import { z } from "zod";
import { Button } from "@/app/components/ui/button";

const timeRegex = /^(\d{1,2}):([0-5]\d)$/;

const downloadSchema = z
  .object({
    endTime: z.string().regex(timeRegex, "End time must be in MM:SS format"),
    startTime: z.string().regex(timeRegex, "Start time must be in MM:SS format"),
    url: z
      .string()
      .url("Must be a valid URL")
      .refine(
        (url) => url.includes("youtube.com") || url.includes("youtu.be"),
        "Must be a YouTube URL",
      ),
  })
  .refine(
    (data) => {
      const startSeconds = parseTimeToSeconds(data.startTime);
      const endSeconds = parseTimeToSeconds(data.endTime);
      return startSeconds < endSeconds;
    },
    {
      message: "Start time must be before end time",
      path: ["endTime"],
    },
  );

type FormData = z.infer<typeof downloadSchema>;
type FormErrors = Partial<Record<keyof FormData | "root", string>>;

function parseTimeToSeconds(time: string): number {
  const match = time.match(timeRegex);
  if (!match) return 0;
  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  return minutes * 60 + seconds;
}

export default function Home() {
  const endTimeId = useId();
  const optimizeLoopId = useId();
  const startTimeId = useId();
  const urlId = useId();

  const [endTime, setEndTime] = useState("10:00");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [optimizeLoop, setOptimizeLoop] = useState(true);
  const [startTime, setStartTime] = useState("00:00");
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const formData = { endTime, startTime, url };
      const validated = downloadSchema.parse(formData);

      const response = await fetch("/api/download", {
        body: JSON.stringify({
          endTime: parseTimeToSeconds(validated.endTime),
          optimizeLoop,
          startTime: parseTimeToSeconds(validated.startTime),
          url: validated.url,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: "Download failed",
        }));
        throw new Error(error.error || "Download failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] ||
        `soundtrack-${startTime.replace(":", "-")}-${endTime.replace(":", "-")}.mp3`;

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      setEndTime("");
      setStartTime("");
      setUrl("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: FormErrors = {};
        for (const issue of error.issues) {
          const path = issue.path[0] as keyof FormData;
          fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
      } else if (error instanceof Error) {
        setErrors({ root: error.message });
      } else {
        setErrors({ root: "An unexpected error occurred" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <main className="w-full max-w-2xl">
        <div className="mb-8 text-center sm:mb-12">
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground sm:mb-4 sm:text-4xl md:text-5xl">
            YouTube Soundtrack Downloader
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400 sm:text-lg">
            Download MP3 audio segments from long YouTube videos
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor={urlId} className="mb-2 block text-sm font-medium text-foreground">
              YouTube URL
            </label>
            <input
              id={urlId}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground transition-colors placeholder:text-gray-400 focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-gray-700 dark:bg-gray-900 dark:placeholder:text-gray-600"
              disabled={isLoading}
            />
            {errors.url && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.url}</p>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor={startTimeId}
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Start Time
              </label>
              <input
                id={startTimeId}
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="05:30"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground transition-colors placeholder:text-gray-400 focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-gray-700 dark:bg-gray-900 dark:placeholder:text-gray-600"
                disabled={isLoading}
              />
              {errors.startTime && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.startTime}</p>
              )}
            </div>

            <div>
              <label htmlFor={endTimeId} className="mb-2 block text-sm font-medium text-foreground">
                End Time
              </label>
              <input
                id={endTimeId}
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="15:45"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground transition-colors placeholder:text-gray-400 focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-gray-700 dark:bg-gray-900 dark:placeholder:text-gray-600"
                disabled={isLoading}
              />
              {errors.endTime && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.endTime}</p>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <input
              id={optimizeLoopId}
              type="checkbox"
              checked={optimizeLoop}
              onChange={(e) => setOptimizeLoop(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-foreground transition-colors focus:ring-2 focus:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
              disabled={isLoading}
            />
            <label htmlFor={optimizeLoopId} className="flex-1 cursor-pointer select-none">
              <div className="text-sm font-medium text-foreground">
                Optimize for seamless looping
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Applies crossfade to ensure smooth audio loop playback
              </div>
            </label>
          </div>

          {errors.root && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/50">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.root}</p>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full relative"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="relative h-5 w-32 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]"
                    style={{
                      animation: "shimmer 1.5s ease-in-out infinite",
                      backgroundSize: "200% 100%",
                    }}
                  />
                </div>
                <span>Processing...</span>
              </div>
            ) : (
              "Download Audio"
            )}
          </Button>
          <style jsx>{`
            @keyframes shimmer {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(100%);
              }
            }
          `}</style>
        </form>

        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <h2 className="mb-2 text-sm font-semibold text-foreground">How to use:</h2>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <li>1. Paste a YouTube video URL</li>
            <li>2. Enter start and end times in MM:SS format (e.g., 05:30)</li>
            <li>
              3. Click Download Audio and wait for processing to complete using your
              Homebrew-installed yt-dlp and ffmpeg
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
