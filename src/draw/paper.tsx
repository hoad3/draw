import React from 'react';
import FieldDraw from './field_draw';

const Paper: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500 w-screen">
      <div className="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col items-center w-screen">
        <h1 className="text-3xl font-extrabold mb-8 text-center text-gray-800 dark:text-gray-100 tracking-tight">Drawing Board</h1>
        <FieldDraw width={800} height={600} />
      </div>
    </div>
  );
};

export default Paper;