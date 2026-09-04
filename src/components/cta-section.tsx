"use client";

import { Button } from "@/components/ui/button";
import {
  Terminal,
  Github,
  ArrowRight,
} from "lucide-react";
import { useBasePath } from "@/contexts/base-path-context";

export const CTASection = () => {
  const basePath = useBasePath();
  
  return (
    <section className='py-20 bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden'>
      {/* 背景光效 */}
      <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-[100px]' />

      <div className='container mx-auto px-6 relative z-10'>
        <div className='max-w-3xl mx-auto text-center'>
          {/* Main Heading */}
          <h2 className='text-3xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white'>
            Ready to build with
            <span className='bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent'> NeuG</span>?
          </h2>

          {/* Description */}
          <p className='text-lg text-gray-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto'>
            Open source, Apache 2.0 licensed. Start building your graph applications today.
          </p>

          {/* CTA Buttons */}
          <div className='flex flex-col sm:flex-row gap-4 justify-center items-center'>
            <Button
              size='lg'
              className='px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-lg shadow-blue-500/25 transition-all duration-300'
              asChild
            >
              <a href={`${basePath}/en/getting_started/getting_started/`}>
                <Terminal className='w-5 h-5 mr-2' />
                Get Started
                <ArrowRight className='w-5 h-5 ml-2' />
              </a>
            </Button>

            <Button
              variant='outline'
              size='lg'
              className='px-8 py-6 text-lg font-semibold border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-100 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800/50 transition-all duration-300'
              asChild
            >
              <a href="https://github.com/alibaba/neug" target="_blank" rel="noopener noreferrer">
                <Github className='w-5 h-5 mr-2' />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
