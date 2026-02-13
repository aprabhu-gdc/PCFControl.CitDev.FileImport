import * as React from "react";
import { useState, useEffect, createRef } from "react";
import { Caption1, Button, CompoundButton, Spinner, FluentProvider, Theme, webLightTheme,} from "@fluentui/react-components";
import { AttachRegular, AttachFilled, CheckmarkFilled } from "@fluentui/react-icons";
import { iconRegularMapping, iconFilledMapping } from "./iconsMapping";
import { ButtonLoadingStateEnum } from "./utils";
import { getButtonAppearance, getButtonIconPosition, getButtonShape, getButtonSize, getButtonStyle, getDisplayMode,} from "./utils";

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
  // Create a reference for the hidden file input and store raw (unprocessed) files.
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const importFileRef = createRef<HTMLInputElement>();

  // compressImage: Compresses an image file using canvas and returns the compressed data URL.
  const compressImage = (file: File, quality: number): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        console.error(`Error reading image file: ${file.name}`);
        reject(null);
      };

      reader.onload = (e) => {
        const img = new Image();
        
        img.onerror = () => {
          console.error(`Error loading image: ${file.name}`);
          reject(null);
        };

        img.onload = () => {
          try {
            // Create canvas element
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image on canvas
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              console.error('Failed to get canvas context');
              reject(null);
              return;
            }
            
            ctx.drawImage(img, 0, 0);

            // Compress and export as JPEG with specified quality
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
          } catch (error) {
            console.error(`Error compressing image: ${file.name}`, error);
            reject(null);
          }
        };

        img.src = e.target?.result as string;
      };

      reader.readAsDataURL(file);
    });
  };

  // readFile: Reads a file using FileReader and returns its result as a data URL.
  const readFile = (file: File): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      // Handle file reading errors.
      reader.onerror = () => {
        console.error(`Error reading file: ${file.name}`);
        reject(null);
      };

      // When reading is finished, resolve the promise with the result.
      reader.onload = () => {
        resolve(reader.result as string);
      };

      reader.readAsDataURL(file);
    });
  };

  // processBatch: Processes a specific batch (page) of files based on requestPageNumber and batchSize.
  const processBatch = async (pageNumber: number) => {
    if (!rawFiles || rawFiles.length === 0 || pageNumber <= 0) {
      // If no files or invalid page number, output empty result
      onEvent({ 
        filesJSON: "", 
        totalFileCount: 0, 
        currentPageNumber: 0 
      });
      return;
    }

    try {
      if (buttonShowActionSpinner) {
        setButtonLoadingState(ButtonLoadingStateEnum.Loading);
      }

      // Calculate start and end indices for the current page
      const startIndex = (pageNumber - 1) * batchSize;
      const endIndex = Math.min(startIndex + batchSize, rawFiles.length);
      
      // Slice the raw files array to get only the current batch
      const currentBatch = rawFiles.slice(startIndex, endIndex);

      // Process only the current batch of files
      const filesArray = await Promise.all(
        currentBatch.map(async (file) => {
          let fileContent: string | null;
          
          // Check if file is an image and compress it
          if (file.type.startsWith('image/')) {
            fileContent = await compressImage(file, compressionQuality);
          } else {
            fileContent = await readFile(file);
          }

          return {
            name: file.name,
            size: file.size,
            contentBytes: fileContent || "",
          };
        })
      );

      // Convert the batch into a JSON string
      const jsonString = JSON.stringify(filesArray);
      
      // Trigger the onEvent callback with the batch JSON and metadata
      onEvent({ 
        filesJSON: jsonString,
        totalFileCount: rawFiles.length,
        currentPageNumber: pageNumber
      });

      // Set button state to "loaded" if action spinner is enabled
      if (buttonShowActionSpinner) {
        setButtonLoadingState(ButtonLoadingStateEnum.Loaded);
      }
    } catch (error) {
      console.error("Error processing batch:", error);
      setButtonLoadingState(ButtonLoadingStateEnum.Initial);
    }
  };

  // useEffect: Watch for changes to requestPageNumber and process the requested batch
  useEffect(() => {
    if (requestPageNumber > 0 && rawFiles.length > 0) {
      processBatch(requestPageNumber);
    }
  }, [requestPageNumber]);

  // onFileChange: Event handler for when a file is selected using the file input.
  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      // Store raw files without processing them all at once
      const filesArray = Array.from(event.target.files);
      setRawFiles(filesArray);
      
      // Immediately process the first batch (Page 1)
      setButtonLoadingState(ButtonLoadingStateEnum.Initial);
      
      // Clear the input value for re-selection
      event.target.value = "";
      
      // Process first page immediately
      setTimeout(() => processBatch(1), 0);
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
  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      // Store raw files without processing them all at once
      const filesArray = Array.from(event.dataTransfer.files);
      setRawFiles(filesArray);
      
      // Reset button state
      setButtonLoadingState(ButtonLoadingStateEnum.Initial);
      
      // Process first page immediately
      setTimeout(() => processBatch(1), 0);
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
