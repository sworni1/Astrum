"use client";

import { AlertCircle, Download, Eye, ImageIcon, Maximize2 } from "lucide-react";
import Image, { type ImageProps } from "next/image";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ASPECT_RATIO_CLASSES,
  type AspectRatio,
  DEFAULT_BLUR_DATA_URL,
  ROUNDED_CLASSES,
  type Rounded,
  SHADOW_CLASSES,
  type Shadow,
} from "./optimizedImage/styles";
import { Skeleton } from "./ui/skeleton";

interface OptimizedImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
  fallbackSrc?: string;
  fallbackSrcs?: string[];
  showLoadingSpinner?: boolean;
  containerClassName?: string;
  onLoadComplete?: () => void;
  onError?: () => void;
  enableHoverEffects?: boolean;
  showOverlay?: boolean;
  overlayActions?: boolean;
  aspectRatio?: AspectRatio;
  rounded?: Rounded;
  shadow?: Shadow;
  errorVariant?: "minimal" | "detailed" | "retry";
  onImageClick?: () => void;
  onDownload?: () => void;
  onFullscreen?: () => void;
}

const OptimizedImage = React.memo<OptimizedImageProps>(function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  fallbackSrcs = [],
  showLoadingSpinner = false,
  containerClassName,
  className,
  onLoadComplete,
  onError,
  enableHoverEffects = true,
  showOverlay = false,
  overlayActions = false,
  aspectRatio = "auto",
  rounded = "md",
  shadow = "sm",
  errorVariant = "detailed",
  onImageClick,
  onDownload,
  onFullscreen,
  placeholder = "blur",
  blurDataURL = DEFAULT_BLUR_DATA_URL,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  quality = 85,
  priority = false,
  ...props
}) {
  const translate = useTranslations("common");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);
  const fallbackIndexRef = useRef(0);
  const triedSrcsRef = useRef(new Set<string>());
  const imageRef = useRef<HTMLDivElement>(null);

  const allFallbacks = React.useMemo(() => {
    const sources: string[] = [];
    for (const s of fallbackSrcs) {
      if (s && s !== src) sources.push(s);
    }
    if (fallbackSrc && fallbackSrc !== src) sources.push(fallbackSrc);
    return sources;
  }, [fallbackSrcs, fallbackSrc, src]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoadComplete?.();
  }, [onLoadComplete]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    triedSrcsRef.current.add(typeof imageSrc === "string" ? imageSrc : "");

    let nextSrc: string | null = null;
    while (fallbackIndexRef.current < allFallbacks.length) {
      const candidate = allFallbacks[fallbackIndexRef.current];
      fallbackIndexRef.current++;
      if (!triedSrcsRef.current.has(candidate)) {
        nextSrc = candidate;
        break;
      }
    }

    if (nextSrc) {
      setImageSrc(nextSrc);
      setIsLoading(true);
      setHasError(false);
    } else {
      setHasError(true);
      onError?.();
    }
  }, [imageSrc, allFallbacks, onError]);

  const handleRetry = useCallback(() => {
    fallbackIndexRef.current = 0;
    triedSrcsRef.current.clear();
    setIsLoading(true);
    setHasError(false);
    setImageSrc(src);
  }, [src]);

  const handleDownload = useCallback(async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    try {
      // Handle different image source types
      let downloadUrl: string;

      if (typeof imageSrc === "string") {
        downloadUrl = imageSrc;
      } else if (typeof imageSrc === "object" && "src" in imageSrc) {
        downloadUrl = imageSrc.src;
      } else {
        console.error("Cannot download: unsupported image source type");
        return;
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = alt || "image";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  }, [imageSrc, alt, onDownload]);

  const handleFullscreen = useCallback(() => {
    if (onFullscreen) {
      onFullscreen();
      return;
    }

    if (imageRef.current) {
      if (imageRef.current.requestFullscreen) {
        imageRef.current.requestFullscreen();
      }
    }
  }, [onFullscreen]);

  useEffect(() => {
    setImageSrc(src);
    setIsLoading(true);
    setHasError(false);
    fallbackIndexRef.current = 0;
    triedSrcsRef.current.clear();
  }, [src]);

  const renderLoadingState = () => {
    if (!isLoading || !showLoadingSpinner) return null;

    return <Skeleton className="w-full h-full rounded-lg" />;
  };

  const renderErrorState = () => {
    if (!hasError) return null;

    const errorContent = {
      minimal: (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
      ),
      detailed: (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-4">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400 text-center mb-2">
            {translate("imageLoadFailed")}
          </p>
          <p className="text-xs text-gray-500 text-center">{alt}</p>
        </div>
      ),
      retry: (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-4">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400 text-center mb-3">
            {translate("imageLoadFailed")}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            {translate("retry")}
          </button>
        </div>
      ),
    };

    return errorContent[errorVariant];
  };

  const renderOverlay = () => {
    if (!showOverlay && !overlayActions) return null;

    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] transition-all duration-300",
          showOverlay
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        {overlayActions && (
          <div
            className={cn(
              "flex gap-2",
              showOverlay
                ? "pointer-events-auto"
                : "pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto",
            )}
          >
            {onImageClick && (
              <button
                type="button"
                onClick={onImageClick}
                className="p-2 bg-white/90 hover:bg-white rounded-full transition-all duration-200 transform hover:scale-110 shadow-lg"
                title={translate("viewImage")}
              >
                <Eye className="h-4 w-4 text-gray-700" />
              </button>
            )}
            <button
              type="button"
              onClick={handleFullscreen}
              className="p-2 bg-white/90 hover:bg-white rounded-full transition-all duration-200 transform hover:scale-110 shadow-lg"
              title={translate("fullscreen")}
            >
              <Maximize2 className="h-4 w-4 text-gray-700" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 bg-white/90 hover:bg-white rounded-full transition-all duration-200 transform hover:scale-110 shadow-lg"
              title={translate("download")}
            >
              <Download className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const imageElement = (
    <Image
      {...props}
      src={imageSrc}
      alt={alt}
      className={cn(
        "transition-all duration-500 object-cover",
        isLoading ? "opacity-0 scale-105" : "opacity-100 scale-100",
        enableHoverEffects && "group-hover:scale-105",
        ROUNDED_CLASSES[rounded],
        className,
      )}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      sizes={sizes}
      quality={quality}
      priority={priority}
      onLoad={handleLoad}
      onError={handleError}
      unoptimized={typeof imageSrc === "string" && imageSrc.startsWith("http")}
    />
  );

  return (
    <div
      ref={imageRef}
      className={cn(
        "relative overflow-hidden group",
        ASPECT_RATIO_CLASSES[aspectRatio],
        ROUNDED_CLASSES[rounded],
        SHADOW_CLASSES[shadow],
        enableHoverEffects &&
          "transform transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
        containerClassName,
      )}
    >
      {/* Loading State */}
      {renderLoadingState()}

      {/* Error State */}
      {renderErrorState()}

      {/* Main Image */}
      {!hasError &&
        (onImageClick ? (
          <button
            type="button"
            className="block w-full border-0 bg-transparent p-0 text-left"
            aria-label={alt || translate("viewImage")}
            onClick={onImageClick}
          >
            {imageElement}
          </button>
        ) : (
          imageElement
        ))}

      {/* Overlay */}
      {renderOverlay()}

      {/* Hover Ring Effect */}
      {enableHoverEffects && (
        <div
          className={cn(
            "absolute inset-0 ring-2 ring-gray-500/0 transition-all duration-300 pointer-events-none",
            ROUNDED_CLASSES[rounded],
            "group-hover:ring-gray-500/30",
          )}
        />
      )}
    </div>
  );
});

OptimizedImage.displayName = "OptimizedImage";

export default OptimizedImage;

// Export types for better TypeScript support
export type { OptimizedImageProps };
