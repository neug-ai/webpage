"use client";

import { Button } from "@/components/ui/button";
import { 
  CheckCircle,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { useBasePath } from "@/contexts/base-path-context";

export const InstallationSection = () => {
  const basePath = useBasePath();
  
  return (
    <section className="py-24 bg-slate-50 dark:bg-slate-800/50 transition-colors duration-300">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
              Get Started in Seconds
            </h2>
            <p className="text-lg text-gray-600 dark:text-slate-400">
              Install NeuG and create your first graph database
            </p>
          </div>

          {/* Code Block */}
          <div className="bg-slate-900 rounded-2xl p-6 md:p-8 shadow-2xl mb-8">
            <div className='flex items-center gap-2 mb-6'>
              <div className='w-3 h-3 rounded-full bg-red-500'></div>
              <div className='w-3 h-3 rounded-full bg-yellow-500'></div>
              <div className='w-3 h-3 rounded-full bg-green-500'></div>
              <span className='text-sm text-slate-500 ml-3 font-mono'>
                python
              </span>
            </div>
            
            <div className="font-mono text-sm md:text-base space-y-4">
              {/* Install */}
              <div className="text-slate-300">
                <span className="text-slate-500"># Install</span>
              </div>
              <div className="text-slate-300">
                <span className="text-blue-400">$</span>
                <span className="ml-2">pip install neug</span>
              </div>
              
              {/* Quick Start */}
              <div className="text-slate-300 pt-4">
                <span className="text-slate-500"># Create a graph database</span>
              </div>
              <div className="text-slate-300">
                <span className="text-purple-400">import</span> neug
              </div>
              <div className="text-slate-300">
                db = neug.<span className="text-yellow-400">Database</span>(<span className="text-green-400">""</span>)  <span className="text-slate-500"># in-memory</span>
              </div>
              <div className="text-slate-300">
                conn = db.<span className="text-yellow-400">connect</span>()
              </div>
              
              {/* Query */}
              <div className="text-slate-300 pt-4">
                <span className="text-slate-500"># Run a Cypher query</span>
              </div>
              <div className="text-slate-300">
                result = conn.<span className="text-yellow-400">execute</span>(<span className="text-green-400">"MATCH (n) RETURN count(n)"</span>)
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Python 3.8+</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Linux & macOS</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>x86 & ARM</span>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button
              size="lg"
              variant="outline"
              className="px-6 py-5 text-base font-medium border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-100 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
              asChild
            >
              <a href={`${basePath}/en/overview/introduction/`}>
                <BookOpen className="w-5 h-5 mr-2" />
                Read the Documentation
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
