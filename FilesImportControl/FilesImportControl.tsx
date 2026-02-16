import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Caption1, Button, CompoundButton, Spinner, FluentProvider, Theme, webLightTheme,} from "@fluentui/react-components";
import { AttachRegular, AttachFilled, CheckmarkFilled } from "@fluentui/react-icons";
import { iconRegularMapping, iconFilledMapping } from "./iconsMapping";
import { ButtonLoadingStateEnum } from "./utils";
import { getButtonAppearance, getButtonIconPosition, getButtonShape, getButtonSize, getButtonStyle, getDisplayMode,} from "./utils";

// Maximum pixel dimension for compressed images (width or height).
// Phone photos (4000x3000) are downscaled to fit within this limit,
// reducing canvas memory from ~48MB to ~8MB per image.
const MAX_IMAGE_DIMENSION = 1920;

export interface IFilesImportControlProps {
  buttonText: string;
  buttonIcon: string;
  buttonIconStyle: string;
  buttonAppearance: string;
  buttonAlign: string;
  buttonVisible: boolean;
  buttonFontWeight: string;
  buttonDisplayMode: string;
  buttonWidth: number;
  buttonHeight: number;
  buttonShowSecondaryContent: boolean;
  buttonSecondaryContent: string;
  buttonShowActionSpinner: boolean;
  buttonIconPosition: string;
  buttonShape: string;
  buttonButtonSize: string;
  buttonDisabledFocusable: boolean;
  buttonAllowMultipleFiles: boolean;
  buttonAllowedFileTypes: string;
  buttonAllowDropFiles: boolean;
  buttonAllowDropFilesText: string;
  compressionQuality: number;
  requestPageNumber: number;
  batchSize: number;
  canvasAppCurrentTheme: Theme;
  onEvent: (event: any) => void;
}

export const FilesImportControl: React.FC<IFilesImportControlProps> = ({
  buttonText,
  buttonIcon,
  buttonIconStyle,
  buttonAppearance,
  buttonAlign,
  buttonVisible,
  buttonFontWeight,
  buttonDisplayMode,
  buttonWidth,
  buttonHeight,
  buttonShowSecondaryContent,
  buttonSecondaryContent,
  buttonShowActionSpinner,
  buttonIconPosition,
  buttonShape,
  buttonButtonSize,
  buttonDisabledFocusable,
  buttonAllowMultipleFiles,
  buttonAllowedFileTypes,
  buttonAllowDropFiles,
  buttonAllowDropFilesText,
  compressionQuality,
  requestPageNumber,
  batchSize,
  canvasAppCurrentTheme,
  onEvent
}) => {
  
  // THEME
  // Use the provided theme if available; otherwise, fall back to the default webLightTheme.
  const _theme = canvasAppCurrentTheme?.fontFamilyBase?.trim()
    ? canvasAppCurrentTheme
    : webLightTheme;

  // BUTTON
  // Maintain the loading state for the button and define a function to determine which icon to display.
  const [buttonLoadingState, setButtonLoadingState] = useState<ButtonLoadingStateEnum>(
    ButtonLoadingStateEnum.Initial
  );

  const getButtonIcon = () => {
    if (buttonLoadingState === "loading") return <Spinner size="tiny" />;
    if (buttonLoadingState === "loaded") return <CheckmarkFilled />;
    return buttonIconStyle === "1"
      ? iconFilledMapping[buttonIcon] || <AttachFilled />
      : iconRegularMapping[buttonIcon] || <AttachRegular />;
  };

  // Prepare common button props using helper functions.
  const _buttonProps = {
    icon: getButtonIcon(),
    disabledFocusable: buttonDisabledFocusable,
    appearance: getButtonAppearance(buttonAppearance),
    iconPosition: getButtonIconPosition(buttonIconPosition),
    shape: getButtonShape(buttonShape),
    size: getButtonSize(buttonButtonSize),
    style: getButtonStyle(buttonWidth, buttonHeight, buttonAlign, buttonFontWeight),
    disabled: getDisplayMode(buttonLoadingState, buttonDisplayMode),
  };

  // FILES
  // Use a ref instead of state for raw files — File handles don't need to trigger re-renders
  // and keeping them in state with 100+ files causes unnecessary render cycles.
  const rawFilesRef = useRef<File[]>([]);
  const [rawFileCount, setRawFileCount] = useState<number>(0);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Reusable canvas kept outside the per-file scope so we allocate only once.
  // This avoids repeated canvas create/destroy overhead across files within a batch.
  const reusableCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const getReusableCanvas = (): HTMLCanvasElement => {
    if (!reusableCanvasRef.current) {
      reusableCanvasRef.current = document.createElement("canvas");
    }
    return reusableCanvasRef.current;
  };

  // compressImage: Compresses and downscales an image file using canvas.
  // Uses createObjectURL instead of readAsDataURL for lighter intermediate loading,
  // downscales to MAX_IMAGE_DIMENSION, and explicitly cleans up all resources.
  const compressImage = (file: File, quality: number): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      // Use createObjectURL — it's a lightweight pointer to the file blob,
      // unlike readAsDataURL which converts the entire file to a base64 string.
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        console.error(`Error loading image: ${file.name}`);
        reject(null);
      };

      img.onload = () => {
        try {
          // --- Downscale to MAX_IMAGE_DIMENSION ---
          // A 4000x3000 canvas = ~48MB RGBA. Downscaling to 1920x1440 = ~11MB.
          let { width, height } = img;
          if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
            const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Reuse a single canvas element to avoid allocation churn
          const canvas = getReusableCanvas();
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            console.error("Failed to get canvas context");
            reject(null);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Compress and export as JPEG with specified quality
          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);

          // --- Explicit cleanup ---
          // Clear the canvas buffer immediately to free ~11MB of RGBA pixel memory
          canvas.width = 0;
          canvas.height = 0;
          // Revoke the object URL to release the file blob reference
          URL.revokeObjectURL(objectUrl);
          // Detach the image source to allow GC of the decoded bitmap
          img.src = "";

          resolve(compressedDataUrl);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          img.src = "";
          console.error(`Error compressing image: ${file.name}`, error);
          reject(null);
        }
      };

      img.src = objectUrl;
    });
  };

  // readFile: Reads a non-image file using FileReader and returns its result as a data URL.
  const readFile = (file: File): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        console.error(`Error reading file: ${file.name}`);
        reject(null);
      };

      reader.onload = () => {
        resolve(reader.result as string);
      };

      reader.readAsDataURL(file);
    });
  };

  // processFileSequentially: Processes a single file (compress or read).
  // Returns the result object for one file.
  const processOneFile = async (file: File, quality: number): Promise<{ name: string; size: number; contentBytes: string }> => {
    let fileContent: string | null;
    if (file.type.startsWith("image/")) {
      fileContent = await compressImage(file, quality);
    } else {
      fileContent = await readFile(file);
    }
    return {
      name: file.name,
      size: file.size,
      contentBytes: fileContent || "",
    };
  };

  // processBatchSequentially: Processes files ONE AT A TIME (not Promise.all).
  // This ensures only one canvas / FileReader is in memory at any moment,
  // making it safe to handle 100+ images without OOM crashes.
  const processBatchSequentially = async (
    files: File[],
    startIndex: number,
    endIndex: number,
    quality: number
  ): Promise<{ name: string; size: number; contentBytes: string }[]> => {
    const results: { name: string; size: number; contentBytes: string }[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      const result = await processOneFile(files[i], quality);
      results.push(result);
      // Yield to the event loop between files so the browser can run GC
      // and remain responsive (prevents long-task jank).
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    return results;
  };

  // processBatch: Processes a specific batch (page) of files based on requestPageNumber and batchSize.
  const processBatch = useCallback(async (pageNumber: number) => {
    const files = rawFilesRef.current;
    if (!files || files.length === 0) {
      return;
    }

    if (pageNumber <= 0) {
      return;
    }

    const startIndex = (pageNumber - 1) * batchSize;

    if (startIndex >= files.length) {
      onEvent({
        filesJSON: JSON.stringify([]),
        totalFileCount: files.length,
        currentPageNumber: pageNumber,
      });
      return;
    }

    try {
      if (buttonShowActionSpinner) {
        setButtonLoadingState(ButtonLoadingStateEnum.Loading);
      }

      const endIndex = Math.min(startIndex + batchSize, files.length);

      // Process files ONE AT A TIME to keep peak memory low
      const filesArray = await processBatchSequentially(files, startIndex, endIndex, compressionQuality);

      const jsonString = JSON.stringify(filesArray);

      onEvent({
        filesJSON: jsonString,
        totalFileCount: files.length,
        currentPageNumber: pageNumber,
      });

      if (buttonShowActionSpinner) {
        setButtonLoadingState(ButtonLoadingStateEnum.Loaded);
      }
    } catch (error) {
      console.error("Error processing batch:", error);
      setButtonLoadingState(ButtonLoadingStateEnum.Initial);
    }
  }, [rawFileCount, batchSize, compressionQuality, buttonShowActionSpinner, onEvent]);

  // useEffect: Watch for changes to requestPageNumber and process the requested batch
  useEffect(() => {
    if (requestPageNumber > 0 && rawFilesRef.current.length > 0) {
      processBatch(requestPageNumber);
    }
  }, [requestPageNumber, rawFileCount, processBatch]);

  // onFileChange: Event handler for when a file is selected using the file input.
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const filesArray = Array.from(event.target.files);

      // Reset button state
      setButtonLoadingState(ButtonLoadingStateEnum.Initial);

      // Store raw files in the ref (no re-render needed for the files themselves)
      rawFilesRef.current = filesArray;
      // Update count to trigger the useEffect / re-render for pagination
      setRawFileCount(filesArray.length);

      // Process first batch immediately
      setTimeout(() => {
        processBatchWithFiles(filesArray, 1);
      }, 10);

      // Clear the input value so the same selection can be re-picked
      event.target.value = "";
    }
  };

  // Helper to process batch with explicit files array (avoids stale closure on initial selection)
  const processBatchWithFiles = async (files: File[], pageNumber: number) => {
    if (!files || files.length === 0 || pageNumber <= 0) return;

    const startIndex = (pageNumber - 1) * batchSize;
    if (startIndex >= files.length) return;

    try {
      if (buttonShowActionSpinner) {
        setButtonLoadingState(ButtonLoadingStateEnum.Loading);
      }

      const endIndex = Math.min(startIndex + batchSize, files.length);

      // Process files ONE AT A TIME
      const filesArray = await processBatchSequentially(files, startIndex, endIndex, compressionQuality);

      const jsonString = JSON.stringify(filesArray);
      onEvent({
        filesJSON: jsonString,
        totalFileCount: files.length,
        currentPageNumber: pageNumber,
      });

      if (buttonShowActionSpinner) {
        setButtonLoadingState(ButtonLoadingStateEnum.Loaded);
      }
    } catch (error) {
      console.error("Error processing batch:", error);
      setButtonLoadingState(ButtonLoadingStateEnum.Initial);
    }
  };

  // handleButtonClick: Resets the button loading state and triggers the hidden file input click.
  const handleButtonClick = () => {
    setButtonLoadingState(ButtonLoadingStateEnum.Initial);
    importFileRef.current?.click();
  };

  // DRAG & DROP HANDLING
  // Maintain a state for whether a file is being dragged over the control.
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);

  // onDragEnter: Triggered when a dragged item enters the drop zone.
  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  // onDragOver: Triggered continuously while a dragged item is over the drop zone.
  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  // onDragLeave: Triggered when a dragged item leaves the drop zone.
  const onDragLeave = (event: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(event.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  // onDrop: Triggered when a file is dropped onto the control.
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const filesArray = Array.from(event.dataTransfer.files);

      // Reset button state
      setButtonLoadingState(ButtonLoadingStateEnum.Initial);

      // Store raw files in the ref and process first batch
      rawFilesRef.current = filesArray;
      setRawFileCount(filesArray.length);

      setTimeout(() => {
        processBatchWithFiles(filesArray, 1);
      }, 10);
    }
  };

  return (
    <div
      ref={dropZoneRef}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: (isDragging && buttonAllowDropFiles) ? `1px dashed ${_theme.colorBrandBackground}` : "0px none transparent",
        padding: (isDragging && buttonAllowDropFiles) ? `10px` : "0px",
        borderRadius: (isDragging && buttonAllowDropFiles) ? `5px` : "0px",
        height: (isDragging && buttonAllowDropFiles) ? buttonHeight + 10 : buttonHeight,
        width:(isDragging && buttonAllowDropFiles) ? buttonWidth + 10 : buttonWidth,
        textAlign: "center",  
        transition: "border 1s ease-in-out",
        backgroundColor: (isDragging && buttonAllowDropFiles)   ? `${_theme.colorBrandBackground2}25` : "transparent", 
        backdropFilter: (isDragging && buttonAllowDropFiles) ? "blur(10px)" : "none", 
      }}
    >
      {buttonVisible ? (
        <FluentProvider theme={_theme}>
          {buttonShowSecondaryContent ? (
            <CompoundButton onClick={handleButtonClick} {..._buttonProps} secondaryContent={buttonSecondaryContent}>
              {buttonText}
            </CompoundButton>
          ) : (
            <Button onClick={handleButtonClick} {..._buttonProps}>
              {buttonText}
            </Button>
          )}
        </FluentProvider>
      ) : null}
      {/* Hidden file input for file selection */}
      <input
        ref={importFileRef}
        multiple={buttonAllowMultipleFiles}
        type="file"
        accept={buttonAllowedFileTypes}
        onChange={onFileChange}
        style={{ display: "none" }}
      />
      {/* Show drag-and-drop text when dragging files over and drag/drop is allowed */}
      {(isDragging && buttonAllowDropFiles) && <Caption1>{buttonAllowDropFilesText}</Caption1>}
    </div>
  );
};
