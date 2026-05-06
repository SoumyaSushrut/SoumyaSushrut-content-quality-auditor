import React, { useState } from 'react';
import PWLogo from './components/PWLogo';
import ReportDashboard from './components/ReportDashboard';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function App() {
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [report, setReport] = useState(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.txt') || droppedFile.name.endsWith('.pdf'))) {
      setFile(droppedFile);
      setNotes('');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setNotes('');
    }
  };

  const handleAudit = async () => {
    if (!notes.trim() && !file) return;
    
    setIsAuditing(true);
    setReport(null);

    try {
      let contentToAudit = notes;
      
      if (file) {
        if (file.name.endsWith('.pdf')) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            text += pageText + '\n';
          }
          contentToAudit = text;
        } else {
          contentToAudit = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
          });
        }
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${API_URL}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: contentToAudit })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      setReport(data);

    } catch (error) {
      console.error("Failed to audit notes:", error);
      alert("We're experiencing heavy traffic or the server is starting up. Please wait 10 seconds and try again!");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {/* Header */}
      <header className="bg-black shadow-sm border-b border-white/10 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PWLogo className="w-10 h-10" />
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Physics Wallah <span className="text-white font-bold">—</span> Content Quality Auditor
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-gray-400">
            <CheckCircle2 size={16} className="text-white" />
            System Online
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-10 px-4 sm:px-6 flex flex-col items-center">
        {!report && !isAuditing && (
          <div className="max-w-4xl w-full animate-fade-in-up">
            <div className="bg-zinc-900 rounded-3xl shadow-2xl p-8 border border-white/10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Submit Content for Audit</h2>
                <p className="text-gray-400">Paste your teaching notes or class script below. Our AI will analyze concepts, questions, and answers for JEE/NEET standards.</p>
              </div>

              <div 
                className={`relative mb-6 group transition-all rounded-2xl ${isDragging ? 'ring-2 ring-white scale-[1.01]' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {!file ? (
                  <>
                    <div className="absolute inset-y-0 left-0 w-12 bg-zinc-950 rounded-l-2xl border-r border-zinc-800 flex flex-col items-center py-4 text-zinc-500 text-xs font-mono select-none pointer-events-none">
                      {[...Array(15)].map((_, i) => <div key={i} className="leading-6">{i + 1}</div>)}
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Paste your notes here or drag & drop a PDF/TXT file..."
                      className="w-full h-96 pl-16 pr-6 py-4 bg-black border border-zinc-800 rounded-2xl focus:border-white focus:ring-1 focus:ring-white transition-all outline-none resize-none font-mono text-sm text-zinc-200 leading-6 shadow-inner"
                      spellCheck="false"
                    />
                    
                    {/* Upload overlay hint */}
                    <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-zinc-800/90 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <label className="cursor-pointer flex items-center gap-2 hover:text-white transition-colors">
                        <UploadCloud size={14} /> drag & drop or click to upload PDF/TXT
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileChange} />
                      </label>
                    </div>

                    {isDragging && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl border-2 border-dashed border-white flex flex-col items-center justify-center z-10 pointer-events-none">
                        <UploadCloud size={48} className="text-white mb-4 animate-bounce" />
                        <p className="text-xl font-bold text-white">Drop your file here</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-96 bg-black border border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative shadow-inner">
                    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-700 flex flex-col items-center max-w-sm w-full">
                      <FileText size={48} className="text-white mb-4" />
                      <p className="text-white font-medium text-center truncate w-full px-4">{file.name}</p>
                      <p className="text-zinc-500 text-xs mt-1">{formatFileSize(file.size)}</p>
                      <button 
                        onClick={() => setFile(null)}
                        className="mt-6 text-xs text-red-400 hover:text-red-300 transition-colors bg-red-400/10 px-4 py-2 rounded-full"
                      >
                        Remove File
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleAudit}
                  disabled={!notes.trim() && !file}
                  className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all transform active:scale-95 shadow-lg
                    ${(notes.trim() || file) 
                      ? 'bg-white hover:bg-gray-200 text-black shadow-white/10 hover:shadow-white/20' 
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'}`}
                >
                  <FileText size={20} />
                  Audit Notes
                </button>
              </div>
            </div>
          </div>
        )}

        {isAuditing && (
          <div className="flex-grow flex flex-col items-center justify-center min-h-[60vh]">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-white/10 rounded-full blur-xl animate-pw-pulse"></div>
              <PWLogo className="w-24 h-24 relative z-10 animate-pw-pulse drop-shadow-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">Analyzing Content...</h2>
            <p className="text-gray-400 font-medium max-w-sm text-center">Checking concept accuracy, question quality, and answer correctness against JEE/NEET standards.</p>
          </div>
        )}

        {report && !isAuditing && (
          <div className="w-full">
            <button 
              onClick={() => setReport(null)}
              className="mb-6 mx-auto flex items-center gap-2 text-sm font-medium text-white hover:text-gray-300 bg-zinc-900 px-4 py-2 rounded-full shadow-sm border border-zinc-800 transition-colors"
            >
              ← Audit another document
            </button>
            <ReportDashboard report={report} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 py-6 text-center text-sm font-medium mt-auto text-gray-500">
        Ensuring the Best for <span className="text-white font-bold">JEE/NEET</span> Aspirants
      </footer>
    </div>
  );
}

export default App;
