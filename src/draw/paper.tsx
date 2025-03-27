import React from 'react';
import FieldDraw from './field_draw';

const Paper: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Drawing Board</h1>
        <FieldDraw width={800} height={600} />
      </div>
    </div>
  );
};

export default Paper; 