import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Copy, Download, BookOpen, HelpCircle, Target } from 'lucide-react';

const CircularProgress = ({ score }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let color = "text-green-500";
  if (score < 60) color = "text-red-500";
  else if (score < 80) color = "text-yellow-500";

  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-32 h-32 transform -rotate-90">
        <circle
          className="text-gray-200 stroke-current"
          strokeWidth="8"
          cx="64"
          cy="64"
          r={radius}
          fill="transparent"
        ></circle>
        <circle
          className={`${color} stroke-current animate-dash transition-all duration-1000 ease-out`}
          strokeWidth="8"
          strokeLinecap="round"
          cx="64"
          cy="64"
          r={radius}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        ></circle>
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-pw-dark">{score}</span>
        <span className="text-xs text-gray-500 font-medium">/ 100</span>
      </div>
    </div>
  );
};

const CategoryCard = ({ title, data, icon: Icon, delay }) => {
  const { score, issues } = data;
  let statusColor = "bg-green-100 text-green-700 border-green-200";
  let iconColor = "text-green-500";
  let StatusIcon = CheckCircle;

  if (score < 60) {
    statusColor = "bg-red-100 text-red-700 border-red-200";
    iconColor = "text-red-500";
    StatusIcon = XCircle;
  } else if (score < 80) {
    statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
    iconColor = "text-yellow-500";
    StatusIcon = AlertTriangle;
  }

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fade-in-up ${delay} flex flex-col h-full`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${statusColor}`}>
            <Icon size={20} />
          </div>
          <h3 className="font-semibold text-pw-dark">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold">{score}</span>
          <span className="text-sm text-gray-400">/100</span>
        </div>
      </div>
      
      <div className="flex-grow">
        {issues.length > 0 ? (
          <ul className="space-y-2 mt-2">
            {issues.map((issue, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <StatusIcon size={14} className={`mt-1 flex-shrink-0 ${iconColor}`} />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
            <CheckCircle size={14} /> No issues found. Great job!
          </p>
        )}
      </div>
    </div>
  );
};

const ReportDashboard = ({ report }) => {
  if (!report) return null;

  return (
    <div className="max-w-5xl mx-auto w-full animate-fade-in-up">
      <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden mb-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-pw-dark to-[#1A2E44] px-8 py-6 text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-white rounded-full p-2">
              <CircularProgress score={report.overall_score} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Quality Control Report</h2>
              <p className="text-blue-200 text-sm">Automated analysis completed successfully.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Copy size={16} /> Copy Report
            </button>
            <button className="flex items-center gap-2 bg-pw-orange hover:bg-pw-orange-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-pw-orange/30">
              <Download size={16} /> Save PDF
            </button>
          </div>
        </div>

        <div className="p-8 bg-gray-50/50">
          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <CategoryCard 
              title="Concept Accuracy" 
              data={report.concept_accuracy} 
              icon={BookOpen}
              delay="delay-100"
            />
            <CategoryCard 
              title="Question Quality" 
              data={report.question_quality} 
              icon={HelpCircle}
              delay="delay-200"
            />
            <CategoryCard 
              title="Answer Correctness" 
              data={report.answer_correctness} 
              icon={Target}
              delay="delay-300"
            />
          </div>

          {/* Top Fixes Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fade-in-up delay-400">
            <h3 className="text-lg font-bold text-pw-dark mb-4 flex items-center gap-2">
              <AlertTriangle className="text-pw-orange" size={20} />
              Top Fixes Needed
            </h3>
            {report.top_fixes.length > 0 ? (
              <div className="space-y-3">
                {report.top_fixes.map((fix, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                    <div className="bg-pw-orange text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm">
                      {idx + 1}
                    </div>
                    <p className="text-gray-700 text-sm mt-0.5">{fix}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No immediate fixes required.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDashboard;
