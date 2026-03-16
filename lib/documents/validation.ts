/**
 * Request validation helpers for document extraction.
 * Parses multipart input, validates file count, type, and size.
 */

import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
} from "@/lib/constants";

export interface ValidatedFile {
  file: File;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export type ValidationResult =
  | { success: true; files: ValidatedFile[] }
  | { success: false; error: ValidationError };

export interface ValidationError {
  type: "NO_FILES" | "INVALID_FILE_TYPE" | "FILE_TOO_LARGE" | "TOO_MANY_FILES";
  message: string;
  details: {
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    count?: number;
    maxFiles?: number;
    maxBytes?: number;
  };
}

export async function parseAndValidateFiles(
  request: Request
): Promise<ValidationResult> {
  const formData = await request.formData();

  const files: File[] = [];

  const filesEntry = formData.getAll("files");
  for (const entry of filesEntry) {
    if (entry instanceof File) {
      files.push(entry);
    }
  }

  const singleFile = formData.get("file");
  if (singleFile instanceof File && files.length === 0) {
    files.push(singleFile);
  }

  if (files.length === 0) {
    return {
      success: false,
      error: {
        type: "NO_FILES",
        message: "No files provided",
        details: {},
      },
    };
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    return {
      success: false,
      error: {
        type: "TOO_MANY_FILES",
        message: `Too many files: ${files.length}. Max ${MAX_FILES_PER_REQUEST} files per request.`,
        details: {
          count: files.length,
          maxFiles: MAX_FILES_PER_REQUEST,
        },
      },
    };
  }

  const validatedFiles: ValidatedFile[] = [];

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        success: false,
        error: {
          type: "INVALID_FILE_TYPE",
          message: `Invalid file type: ${file.type}. Allowed: PDF, JPEG, PNG, WebP.`,
          details: {
            filename: file.name,
            mimeType: file.type,
          },
        },
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: {
          type: "FILE_TOO_LARGE",
          message: `File too large: ${file.name}. Max ${(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(1)} MB.`,
          details: {
            filename: file.name,
            sizeBytes: file.size,
            maxBytes: MAX_FILE_SIZE_BYTES,
          },
        },
      };
    }

    validatedFiles.push({
      file,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
  }

  return { success: true, files: validatedFiles };
}
