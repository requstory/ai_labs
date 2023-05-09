import os
import streamlit as st
import requests
import nltk 
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.text_splitter import NLTKTextSplitter
from langchain.vectorstores import Chroma
from langchain.docstore.document import Document
from langchain.prompts import PromptTemplate
from langchain.indexes.vectorstore import VectorstoreIndexCreator
from langchain.chains.question_answering import load_qa_chain
from langchain.document_loaders import TextLoader
from langchain.llms import OpenAI



nltk.download('punkt')
st.title('Document QA')
st.write(
    os.environ["OPENAI_API_KEY"] == st.secrets["OPENAI_API_KEY"],
)

# Prompt the user to enter a URL
url = st.text_input('Enter the URL of a text document:')

# Load the document from the URL
if url:
    response = requests.get(url)
    if response.status_code == 200:
        text = response.text
        st.write('Document loaded successfully!')
        
        # Split the document into sentences
        text_splitter = NLTKTextSplitter()
        sentences = text_splitter.split_text(text)
        
        # Create a vectorstore index for the document
        embeddings = OpenAIEmbeddings()
        docsearch = Chroma.from_texts(sentences, embeddings, metadatas=[{"source": str(i)} for i in range(len(sentences))]).as_retriever()
        question = "What is life?"
        docs = docsearch.get_relevant_documents(question)
        index_creator = VectorstoreIndexCreator()
        

        # Load the question-answering chain
        chain = load_qa_chain(OpenAI(temperature=0), chain_type="refine")
    else:
        st.write('Error loading document. Please check the URL and try again.')
        st.stop()

# Prompt the user to enter a question
question = st.text_input('Enter your question:')

# Answer the question using the document and the question-answering chain
if url and question:
    docs = docsearch.get_relevant_documents(question)
    outputs = chain({"input_documents": docs, "question": question}, return_only_outputs=True)
    st.write(outputs)
