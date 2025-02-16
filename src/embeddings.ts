import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import fs from "fs/promises";
import path from "path";
import { Chroma } from "@langchain/community/vectorstores/chroma";
/**
 * Load all markdown notes from your vault folder.
 * Adjust the file extension filter if necessary.
 */
export async function loadVaultNotes(vaultPath: string): Promise<Document[]> {
    const files = await fs.readdir(vaultPath);
    const mdFiles = files.filter(file => file.endsWith(".md"));
    const docs: Document[] = [];

    for (const file of mdFiles) {
        const filePath = path.join(vaultPath, file);
        const content = await fs.readFile(filePath, "utf8");
        docs.push({ pageContent: content, metadata: { fileName: file } });
    }
    return docs;
}

/**
 * Create a vector store for your vault notes.
 * This function computes embeddings (using OpenAIEmbeddings in this example)
 * for each note and stores them in an in-memory vector store.
 */
export async function createVectorStore(vaultPath: string): Promise<Chroma> {
    const docs = await loadVaultNotes(vaultPath);
    // Replace OpenAIEmbeddings with a custom implementation if you prefer BGE-micro-v2.
    const embeddings = new OpenAIEmbeddings({ model: "text-embedding-ada-002" });
    // const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    const vectorStore = new Chroma(embeddings, {
        collectionName: "a-test-collection",
    });
    // return vectorStore;
    await vectorStore.addDocuments(docs);
    return vectorStore;
}

/**
 * Save the vector store to a JSON file locally.
 * (This is a simple approach; for larger datasets, consider a dedicated vector DB.)
 */
export async function saveVectorStore(vectorStore: Chroma, savePath: string): Promise<void> {
    const storeData = vectorStore.embeddings;
    await fs.writeFile(savePath, JSON.stringify(storeData, null, 2), "utf8");
}

/**
 * Load the vector store from a JSON file.
 */
export async function loadVectorStore(savePath: string): Promise<Chroma> {
    const data = await fs.readFile(savePath, "utf8");
    const storeData = JSON.parse(data);
    const embeddings = new OpenAIEmbeddings({ model: "text-embedding-ada-002", apiKey: process.env.OPENAI_API_KEY });
    const vectorStore = new Chroma(embeddings, {
        collectionName: "rami-journal-embeddings",
    });
    vectorStore.addDocuments(storeData)
    return vectorStore;
}

/**
 * Given a query text, find the most similar notes in the vector store.
 */
export async function findSimilarNotes(
    vectorStore: Chroma,
    queryText: string,
    topK: number = 5
) {
    const results = await vectorStore.similaritySearch(queryText, topK);
    return results;
}

// // Example usage:
// (async () => {
//   const vaultPath = "/Users/rami/Documents/Obsidian"; // adjust this to your vault's location
//   const vectorStoreFile = path.join(vaultPath, "vectorStore.json");

//   // Check if a stored vector store exists; if so, load it. Otherwise, create it.
//   let vectorStore: Chroma;
//   try {
//     await fs.access(vectorStoreFile);
//     console.log("Loading existing vector store from disk...");
//     vectorStore = await loadVectorStore(vectorStoreFile);
//   } catch (e) {
//     console.log("Creating new vector store...");
//     vectorStore = await createVectorStore(vaultPath);
//     await saveVectorStore(vectorStore, vectorStoreFile);
//   }

//   // Now, given some query content (for your current note), find similar notes.
//   const queryText = "My reflections on today's challenges and learnings."; // replace with your current note content
//   const similarNotes = await findSimilarNotes(vectorStore, queryText, 5);

//   console.log("Top similar notes:");
//   similarNotes.forEach(doc => {
//     console.log(`- ${doc.metadata.fileName}: ${doc.pageContent.substring(0, 100)}...`);
//   });
// })();