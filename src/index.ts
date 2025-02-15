import { z } from "zod";
import { defineDAINService, ToolConfig } from "@dainprotocol/service-sdk";
import { CardUIBuilder, FormUIBuilder } from "@dainprotocol/utils";
import fs from 'fs/promises';
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const VAULT_PATH = '/Users/rami/Documents/Obsidian';

// Function to search for related notes
async function searchRelatedNotes(content: string, excludeTitle: string): Promise<string[]> {
  const files = await fs.readdir(VAULT_PATH);
  const relatedNotes: string[] = [];

  for (const file of files) {
    if (file.endsWith('.md') && file !== `${excludeTitle}.md`) {
      const filePath = path.join(VAULT_PATH, file);
      const fileContent = await fs.readFile(filePath, 'utf8');

      // Simple relevance check: if the new note's content appears in the existing note
      if (fileContent.toLowerCase().includes(content.toLowerCase())) {
        relatedNotes.push(file.replace('.md', ''));
      }

      if (relatedNotes.length >= 2) break; // Stop after finding 2 related notes
    }
  }

  return relatedNotes;
}

const addNoteConfig: ToolConfig = {
  id: "add-note",
  name: "Add Note to Obsidian",
  description: "Creates a new note in your Obsidian vault and finds related notes",
  input: z.object({
    title: z.string().describe("Title of the note"),
    content: z.string().describe("Content of the note"),
    tags: z.array(z.string()).optional().describe("Tags for the note")
  }),
  output: z.object({
    title: z.string().describe("Title of the created note"),
    fileName: z.string().describe("File name of the created note"),
    relatedNotes: z.array(z.string()).describe("Titles of related notes")
  }),
  handler: async ({ title, content, tags }, agentInfo) => {
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
      .title("Note Added")
      .content(`Successfully added note: ${title}\nRelated Notes: ${relatedNotes.join(', ')}`)
      .build();

    return {
      text: `Added note "${title}" to Obsidian vault with ${relatedNotes.length} related notes`,
      data: { title, fileName, relatedNotes },
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
  tools: [addNoteConfig, searchNotesConfig],
});

dainService.startNode({ port: 2022 }).then(() => {
  console.log("Obsidian Integration Service is running on port 2022");
});
