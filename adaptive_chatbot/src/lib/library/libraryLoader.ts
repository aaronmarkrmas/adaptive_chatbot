import { readFileSync } from "node:fs";
import path from "node:path";
import { LibraryIndex } from "./emojiFramework";

let libraryIndex: LibraryIndex | null = null;

export function getLibraryIndex(): LibraryIndex {
  if (!libraryIndex) {
    const csvPath = path.join(process.cwd(), "src", "lib", "library", "library.csv");
    libraryIndex = LibraryIndex.fromCsvText(readFileSync(csvPath, "utf8"));
  }
  return libraryIndex;
}
