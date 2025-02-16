import { z } from "zod";
import { defineDAINService, ToolConfig } from "@dainprotocol/service-sdk";
import { CardUIBuilder } from "@dainprotocol/utils";
import fs from 'fs/promises';
import path from "path";
import dotenv from "dotenv";
import { structureContent, searchRelatedNotes, createDailyNoteViaURI, getTodayNoteFilePath, structureDailyNote, extractMarkdownContent } from "./utils";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

export const VAULT_PATH = process.env.VAULT_PATH || '/Users/rami/Documents/Obsidian';

const addNoteConfig: ToolConfig = {
  id: "add-note",
  name: "Add Structured Note to Obsidian",
  description: "Structures a raw transcript and creates a new note in your Obsidian vault, finding related notes",
  input: z.object({
    rawContent: z.string().describe("Raw transcript of thoughts and reflections"),
  }),
  output: z.object({
    title: z.string().describe("Title of the created note"),
    fileName: z.string().describe("File name of the created note"),
    relatedNotes: z.array(z.string()).describe("Titles of related notes")
  }),
  handler: async ({ rawContent }, agentInfo) => {
    // Structure the content
    const { title, content, tags } = await structureContent(rawContent);

    const fileName = `${title.replace(/\s+/g, '-')}.md`;
    const filePath = path.join(VAULT_PATH, fileName);

    // Search for related notes
    const relatedNotes = await searchRelatedNotes(content, title);

    // Prepare the content with related notes
    let fileContent = `# ${title}\n\n`;

    if (relatedNotes.length > 0) {
      fileContent += "Related Notes:\n";
      for (const note of relatedNotes) {
        fileContent += `- [[${note}]]\n`;
      }
      fileContent += "\n";
    }

    fileContent += `${content}\n`;

    if (tags && tags.length > 0) {
      fileContent += `\nTags: ${tags.join(', ')}`;
    }

    await fs.writeFile(filePath, fileContent, 'utf8');

    const cardUI = new CardUIBuilder()
      .title("Structured Note Added")
      .content(`Successfully added structured note: ${title}\nRelated Notes: ${relatedNotes.join(', ')}`)
      .build();

    return {
      text: `Added structured note "${title}" to Obsidian vault with ${relatedNotes.length} related notes`,
      data: { title, fileName, relatedNotes },
      ui: cardUI
    };
  }
};

const updateTodayNoteConfig: ToolConfig = {
  id: "update-today-note",
  name: "Update Today's Note in Obsidian",
  description: "Structures a raw transcript and updates today's note in your Obsidian vault, creating it if necessary",
  input: z.object({
    rawContent: z.string().describe("Raw transcript of thoughts and reflections"),
  }),
  output: z.object({
    title: z.string().describe("Title of the updated note"),
    fileName: z.string().describe("File name of the updated note"),
    AIResponse: z.string().describe("Content of the updated note"),
    relatedNotes: z.array(z.string()).describe("Titles of related notes")
  }),
  handler: async ({ rawContent }, agentInfo) => {
    const todayFilePath = await getTodayNoteFilePath();
    const title = todayFilePath.replace('.md', '').split('/').pop();
    let fileExists = await fs.access(todayFilePath).then(() => true).catch(() => false);
    console.log("fileExists", fileExists, todayFilePath, title);
    if (!fileExists) {
      await createDailyNoteViaURI();
      fileExists = await fs.access(todayFilePath).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error("Failed to create today's note via Obsidian URI");
      }
    }

    // Read existing content
    let existingContent = await fs.readFile(todayFilePath, 'utf8');

    // Structure the content
    const AIResponse = await structureDailyNote(existingContent, rawContent);
    const updatedDailyNote = extractMarkdownContent(AIResponse);

    // Search for related notes
    const relatedNotes = await searchRelatedNotes(updatedDailyNote, title);

    // Write the updated content back to the file
    await fs.writeFile(todayFilePath, updatedDailyNote, 'utf8');

    const cardUI = new CardUIBuilder()
      .title("Today's Note Updated")
      .content(`Successfully updated today's note with: ${title}\nRelated Notes: ${relatedNotes.join(', ')}`)
      .build();

    return {
      text: `Updated today's note in Obsidian vault with new content "${title}" and ${relatedNotes.length} related notes`,
      data: { title, fileName: path.basename(todayFilePath), AIResponse, relatedNotes },
      ui: cardUI
    };
  }
};

const searchNotesConfig: ToolConfig = {
  id: "search-notes",
  name: "Search Obsidian Notes",
  description: "Searches for notes in your Obsidian vault",
  input: z.object({
    query: z.string().describe("Search query")
  }),
  output: z.object({
    results: z.array(z.object({
      title: z.string().describe("Title of the found note"),
      snippet: z.string().describe("Snippet of the note content")
    }))
  }),
  handler: async ({ query }, agentInfo) => {
    // Implement search logic here
    // This is a placeholder and would need to be replaced with actual search functionality
    const searchResults = [{ title: "Example Note", snippet: "This is a sample result." }];

    const cardUI = new CardUIBuilder()
      .title("Search Results")
      .content(`Found ${searchResults.length} results for "${query}"`)
      .build();

    return {
      text: `Searched for "${query}" in Obsidian vault`,
      data: { results: searchResults },
      ui: cardUI
    };
  }
};

const dainService = defineDAINService({
  metadata: {
    title: "Obsidian Integration Service",
    description: "A service to interact with your Obsidian vault",
    version: "1.0.0",
    author: "Your Name",
    tags: []
  },
  identity: {
    apiKey: process.env.DAIN_API_KEY,
  },
  tools: [addNoteConfig, searchNotesConfig, updateTodayNoteConfig],
});

dainService.startNode({ port: 2023 }).then(() => {
  console.log("Obsidian Integration Service is running on port 2023");
});
