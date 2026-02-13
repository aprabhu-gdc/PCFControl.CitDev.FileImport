# PCF File Import Control - Pagination Guide

## Overview

The PCF control now implements a **"Just-in-Time" Pagination** pattern to handle large batches of images (100+) without crashing the browser or Power Apps. Instead of processing all files at once, it processes them in small batches as requested by Power Apps.

## How It Works

### 1. **User Drops Files**
- User selects or drops 100+ images
- PCF stores raw `File` objects in memory (no processing yet)
- PCF automatically processes **Page 1** (first 5 files by default)
- Outputs:
  - `FilesAsJSON`: JSON with first 5 compressed images
  - `TotalFileCount`: 100
  - `CurrentPageNumber`: 1

### 2. **Power Apps Requests Next Batch**
- Power Apps increments `RequestPageNumber` to 2
- PCF processes files 6-10 (second batch)
- Power Apps saves those to storage
- Repeat until all pages are processed

## PCF Properties

### Input Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `RequestPageNumber` | Whole.None | Yes | 0 | Set by Power Apps to request a specific batch (1, 2, 3, etc.) |
| `BatchSize` | Whole.None | Yes | 5 | Number of files to process per batch. Lower = less memory usage |
| `CompressionQuality` | FP | Yes | 0.7 | Image compression quality (0.1 to 1.0) |

### Output Properties

| Property | Type | Description |
|----------|------|-------------|
| `FilesAsJSON` | Text | JSON string containing the current batch of processed files |
| `TotalFileCount` | Whole.None | Total number of files selected/dropped |
| `CurrentPageNumber` | Whole.None | The page number currently being output (confirmation) |

## Power Apps Implementation

### Step 1: Add the PCF Control

```powerapps
// Add FilesImportControl to your screen
// Set properties:
- AllowMultipleFiles: true
- CompressionQuality: 0.7
- BatchSize: 5
- RequestPageNumber: varCurrentPage
```

### Step 2: Initialize Variables (OnVisible)

```powerapps
// OnVisible of the Screen
Set(varCurrentPage, 0);
Set(varTotalPages, 0);
Set(varProcessingComplete, false);
```

### Step 3: Handle File Selection

```powerapps
// OnChange of the PCF Control
If(
    Self.TotalFileCount > 0,
    // Files were just selected/dropped
    Set(varTotalPages, RoundUp(Self.TotalFileCount / Self.BatchSize, 0));
    Set(varCurrentPage, 1);  // This triggers processing of Page 1
    Set(varProcessingComplete, false)
)
```

### Step 4: Process Batches in a Loop

```powerapps
// Create a Timer control with Duration: 100, Repeat: true
// OnTimerEnd:

If(
    !varProcessingComplete && varCurrentPage > 0 && varCurrentPage <= varTotalPages,
    
    // Save current batch to your data source
    ForAll(
        ParseJSON(FilesImportControl.FilesAsJSON),
        Patch(
            YourFileStorageCollection,
            Defaults(YourFileStorageCollection),
            {
                FileName: Text(Value.name),
                FileSize: Value(Value.size),
                FileContent: Text(Value.contentBytes),
                BatchNumber: varCurrentPage,
                UploadedOn: Now()
            }
        )
    );
    
    // Request next page
    If(
        varCurrentPage < varTotalPages,
        Set(varCurrentPage, varCurrentPage + 1),  // Request next batch
        Set(varProcessingComplete, true)          // All done!
    )
)
```

### Step 5: Show Progress

```powerapps
// Add a Label to show progress:
Text: "Processing " & varCurrentPage & " of " & varTotalPages & " batches..."
Visible: !varProcessingComplete && varCurrentPage > 0
```

## Example: Complete Power Apps Flow

### Screen OnVisible
```powerapps
Set(varCurrentPage, 0);
Set(varTotalPages, 0);
Set(varProcessingComplete, false);
ClearCollect(colUploadedFiles, []);
```

### PCF Control Properties
```powerapps
BatchSize: 5
RequestPageNumber: varCurrentPage
CompressionQuality: 0.7
AllowMultipleFiles: true
```

### PCF Control OnChange
```powerapps
If(
    Self.TotalFileCount > 0,
    Set(varTotalPages, RoundUp(Self.TotalFileCount / Self.BatchSize, 0));
    Set(varCurrentPage, 1);
    Set(varProcessingComplete, false)
)
```

### Timer OnTimerEnd (Duration: 100, Repeat: true)
```powerapps
If(
    !varProcessingComplete && varCurrentPage > 0,
    
    // Collect current batch locally
    Collect(
        colUploadedFiles,
        ForAll(
            ParseJSON(FilesImportControl.FilesAsJSON),
            {
                Name: Text(Value.name),
                Size: Value(Value.size),
                Content: Text(Value.contentBytes),
                Batch: varCurrentPage
            }
        )
    );
    
    // Move to next page or finish
    If(
        varCurrentPage < varTotalPages,
        Set(varCurrentPage, varCurrentPage + 1),
        Set(varProcessingComplete, true)
    )
)
```

### Progress Label
```powerapps
Text: "Processing batch " & varCurrentPage & " of " & varTotalPages
Visible: varCurrentPage > 0 && !varProcessingComplete
```

### Completion Label
```powerapps
Text: "✓ All " & CountRows(colUploadedFiles) & " files processed!"
Visible: varProcessingComplete
```

## Performance Tuning

### BatchSize Recommendations

| Scenario | Recommended BatchSize | Reason |
|----------|----------------------|--------|
| Mobile devices | 3-5 | Limited memory |
| Desktop browser | 5-10 | More memory available |
| Large images (>5MB) | 2-3 | Prevent compression timeouts |
| Small images (<500KB) | 10-15 | Faster processing |

### Memory Optimization

- **Lower BatchSize** = Less memory per batch, but more requests
- **Higher BatchSize** = Faster total time, but more memory per batch
- Start with 5 and adjust based on testing

## Troubleshooting

### Issue: "Processing stuck at Page 1"
**Solution:** Check that Timer control is set to Repeat: true

### Issue: "TotalFileCount is 0"
**Solution:** Ensure AllowMultipleFiles is true and files are being dropped/selected

### Issue: "Browser still crashes"
**Solution:** Reduce BatchSize to 2-3 for very large images

### Issue: "Files not uploading to storage"
**Solution:** Verify ParseJSON is correctly parsing FilesAsJSON output

## Security Note

The console.log that logged file content has been **removed** from the production build for security compliance.

## Testing Checklist

- [ ] Drop 10 files → Should process in 2 batches (5+5)
- [ ] Drop 100 files → Should process in 20 batches (5 each)
- [ ] Drop 1 file → Should process in 1 batch
- [ ] Verify TotalFileCount matches actual count
- [ ] Verify CurrentPageNumber increments correctly
- [ ] Verify no browser memory warnings
- [ ] Test on mobile device

## Summary

This pagination pattern ensures:
✅ **No browser crashes** - Only 5 files processed at once
✅ **Efficient memory usage** - Raw files stored, processed on demand
✅ **Transparent to user** - Automatic batch processing
✅ **Flexible** - Adjustable batch sizes per scenario
✅ **Reliable** - Page confirmation via CurrentPageNumber

---

**Created:** February 13, 2026  
**Version:** 2.0 (Pagination Support)
