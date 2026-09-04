"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Github,
  Terminal,
  Database,
  ArrowRight,
} from "lucide-react";
import { useBasePath } from "@/contexts/base-path-context";
import { NeuGLogo } from "@/components/neug-logo";
import versionsData from "../../versions.json";

export const HeroSection = () => {
  const basePath = useBasePath();
  const currentVersion = versionsData.current;
  
  return (
    <section className='relative min-h-[90vh] flex items-center justify-center overflow-hidden'>
      {/* Background - 日间模式浅色渐变，夜间模式深色渐变 */}
      <div className='absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900' />
      
      {/* 微妙的蓝色光晕 */}
      <div className='absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-[120px]' />
      
      {/* 网格背景 */}
      <div className='absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]' />

      <div className='container mx-auto px-6 text-center relative z-10'>
        {/* Badges */}
        <div className='flex items-center justify-center gap-3 mb-8'>
          <Badge
            variant='outline'
            className='px-4 py-2 border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-300 backdrop-blur-sm'
          >
            <Database className='w-4 h-4 mr-2' />
            Embedded Graph Database
          </Badge>
          <Badge
            variant='outline'
            className='px-3 py-2 font-mono text-sm border-green-300 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-300'
          >
            {currentVersion}
          </Badge>
        </div>

        {/* Main Heading */}
        <h1 className='text-5xl md:text-7xl font-bold mb-6 leading-tight'>
          <NeuGLogo height={80} className='inline-block mx-auto' />
        </h1>

        {/* Subheading - 简洁有力 */}
        <p className='text-xl md:text-2xl text-gray-600 dark:text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed font-light'>
          High-performance embedded graph database for 
          <span className='text-blue-600 dark:text-blue-400 font-medium'> analytics </span>
          and 
          <span className='text-blue-600 dark:text-blue-400 font-medium'> real-time transactions</span>
        </p>

        {/* CTA Buttons */}
        <div className='flex flex-col sm:flex-row gap-4 justify-center items-center mb-16'>
          <Button
            size='lg'
            className='px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300'
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
              View on GitHub
            </a>
          </Button>
        </div>

        {/* Quick Install - 更简洁的终端样式 */}
        <div className='bg-white/80 border border-gray-200 dark:bg-slate-800/60 dark:border-slate-700/50 rounded-2xl p-6 max-w-xl mx-auto backdrop-blur-sm shadow-sm'>
          <div className='flex items-center gap-2 mb-4'>
            <div className='w-3 h-3 rounded-full bg-red-400 dark:bg-red-500/80'></div>
            <div className='w-3 h-3 rounded-full bg-yellow-400 dark:bg-yellow-500/80'></div>
            <div className='w-3 h-3 rounded-full bg-green-400 dark:bg-green-500/80'></div>
            <span className='text-sm text-gray-500 dark:text-slate-500 ml-3 font-mono'>
              terminal
            </span>
          </div>
          <div className='bg-slate-800 dark:bg-slate-900/80 rounded-lg p-4 font-mono text-left'>
            <div className='text-slate-300 text-sm md:text-base'>
              <span className='text-blue-400'>$</span>
              <span className='ml-2'>pip install neug</span>
            </div>
            <div className='text-slate-300 mt-3 text-sm md:text-base'>
              <span className='text-blue-400'>$</span>
              <span className='ml-2'>python -c </span>
              <span className='text-green-400'>"import neug; print('Ready!')"</span>
            </div>
            <div className='text-green-400 mt-2 text-sm'>
              Ready!
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
