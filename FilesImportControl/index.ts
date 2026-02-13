import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { FilesImportControl, IFilesImportControlProps } from "./FilesImportControl";

export class FluentFilesImportControl implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;
    private filesAsJSON: string | null = null;
    private totalFileCount: number = 0;
    private currentPageNumber: number = 0;

    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     * Data-set values are not initialized here, use updateView.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
     */
    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary): void {
        this.notifyOutputChanged = notifyOutputChanged;
    }
    
    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     * @returns ReactElement root react element for the control
     */
    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const props: IFilesImportControlProps = {
            buttonText: context.parameters.Text?.raw || "File upload",
            buttonIcon: context.parameters.ButtonIcon?.raw || "Attach",
            buttonIconStyle: context.parameters.IconStyle?.raw || "Outline",
            buttonAppearance: context.parameters.Appearance?.raw || "Primary",
            buttonAlign: context.parameters.Align?.raw || "Center",
            buttonFontWeight: context.parameters.FontWeight?.raw || "Normal",
            buttonVisible: context.parameters.Visible?.raw ?? true,
            buttonDisplayMode: context.parameters.DisplayMode?.raw || "Edit",
            buttonWidth: context.parameters.Width?.raw || 192,
            buttonHeight: context.parameters.Height?.raw || 32,
            buttonShowSecondaryContent: context.parameters.ShowSecondaryContent?.raw ?? false,
            buttonSecondaryContent: context.parameters.SecondaryContent?.raw || "",
            buttonShowActionSpinner: context.parameters.ShowActionSpinner?.raw ?? true,
            buttonIconPosition: context.parameters.IconPosition?.raw || "Before",
            buttonShape: context.parameters.Shape?.raw || "Rounded",
            buttonButtonSize: context.parameters.ButtonSize?.raw || "Medium",
            buttonDisabledFocusable: context.parameters.DisabledFocusable?.raw ?? false,
            canvasAppCurrentTheme: context.fluentDesignLanguage?.tokenTheme || "webLightTheme",
            buttonAllowMultipleFiles: context.parameters.AllowMultipleFiles?.raw ?? false,
            buttonAllowedFileTypes: context.parameters.AllowedFileTypes?.raw || "*",            
            buttonAllowDropFiles: context.parameters.AllowDropFiles?.raw ?? false,
            buttonAllowDropFilesText: context.parameters.AllowDropFilesText?.raw || "Drop files here...",
            compressionQuality: context.parameters.CompressionQuality?.raw ?? 0.7,
            requestPageNumber: context.parameters.RequestPageNumber?.raw ?? 0,
            batchSize: context.parameters.BatchSize?.raw ?? 5,
            onEvent: this.handleFileUpload.bind(this)
        };

        return React.createElement(FilesImportControl, props);
    }

    /**
     * Handles the file upload event.
     * @param event Contains JSON with the batch of files and pagination metadata.
     */
    private handleFileUpload(event: { filesJSON: string; totalFileCount?: number; currentPageNumber?: number }): void {
        this.filesAsJSON = event.filesJSON;
        this.totalFileCount = event.totalFileCount ?? 0;
        this.currentPageNumber = event.currentPageNumber ?? 0;
        this.notifyOutputChanged();
    }

    /**
     * It is called by the framework prior to a control receiving new data.
     * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
     */
    public getOutputs(): IOutputs {
        return {
            FilesAsJSON: this.filesAsJSON ?? "",
            TotalFileCount: this.totalFileCount,
            CurrentPageNumber: this.currentPageNumber,
        };
    }  

    /**
     * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
     * i.e. cancelling any pending remote calls, removing listeners, etc.
     */
    public destroy(): void {
        // No cleanup needed
    }
}
