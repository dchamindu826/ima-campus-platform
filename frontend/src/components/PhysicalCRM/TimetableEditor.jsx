import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Clock, Book } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MAX_CLASSES_PER_DAY = 4;

export default function TimetableEditor({ value = [], onChange, selectedClasses = [] }) {
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  const getSlotsForDay = (day) => value.filter(item => item.dayOfWeek === day);

  const handleAddSlot = () => {
    if (!startTime || !endTime) {
      toast.error('Please select both start and end times');
      return;
    }
    
    if (selectedClasses.length > 0 && !selectedClassId) {
      toast.error('Please select a class for this time slot');
      return;
    }
    
    const slotsForDay = getSlotsForDay(selectedDay);
    if (slotsForDay.length >= MAX_CLASSES_PER_DAY) {
      toast.error(`Maximum ${MAX_CLASSES_PER_DAY} classes allowed per day`);
      return;
    }

    const newItem = { dayOfWeek: selectedDay, startTime, endTime, classId: selectedClassId ? parseInt(selectedClassId) : null };
    onChange([...value, newItem]);
    
    // Reset times but keep the day selected
    setStartTime('');
    setEndTime('');
  };

  const handleRemoveSlot = (day, indexInDay) => {
    const slotsForDay = getSlotsForDay(day);
    const slotToRemove = slotsForDay[indexInDay];
    
    const globalIndex = value.findIndex(
      v => v.dayOfWeek === slotToRemove.dayOfWeek && 
           v.startTime === slotToRemove.startTime && 
           v.endTime === slotToRemove.endTime
    );
    
    if (globalIndex > -1) {
      const newValue = [...value];
      newValue.splice(globalIndex, 1);
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar size={20} className="text-brand-accent" /> 
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">7-Day Class Timetable</h3>
      </div>

      {/* Add Time Slot Form */}
      <div className="bg-white/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Day of Week</label>
          <select 
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none dark:text-white transition-all text-sm"
          >
            {DAYS.map(day => (
              <option key={day} value={day} className="bg-white dark:bg-brand-darkBg text-gray-900 dark:text-white">{day}</option>
            ))}
          </select>
        </div>

        {selectedClasses.length > 0 && (
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Class</label>
            <div className="relative">
              <Book size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select 
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none dark:text-white transition-all text-sm appearance-none"
              >
                <option value="" className="bg-white dark:bg-brand-darkBg text-gray-900 dark:text-white">Select Class</option>
                {selectedClasses.map(cls => (
                  <option key={cls.id} value={cls.id} className="bg-white dark:bg-brand-darkBg text-gray-900 dark:text-white">{cls.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        <div className="flex-1 w-full">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
          <div className="relative">
            <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="time" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none dark:text-white transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex-1 w-full">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
          <div className="relative">
            <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="time" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none dark:text-white transition-all text-sm"
            />
          </div>
        </div>

        <div className="w-full md:w-auto">
          <button 
            type="button"
            onClick={handleAddSlot}
            className="w-full md:w-auto px-6 py-2.5 bg-brand-accent hover:bg-brand-accentHover text-white rounded-xl font-bold shadow-lg shadow-brand-accent/30 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Add Slot
          </button>
        </div>
      </div>
      
      {/* Horizontal Layout for Landscape Spaces */}
      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="grid grid-cols-7 gap-3 min-w-[900px] items-start">
          {DAYS.map((day) => {
            const slots = getSlotsForDay(day);
            
            return (
              <div key={day} className="flex flex-col bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden min-h-[150px]">
                {/* Day Header */}
                <div className="bg-black/10 dark:bg-white/10 text-center py-3 px-2 text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  {day.slice(0, 3)}
                </div>
                
                {/* Slots Container */}
                <div className="p-3 flex-1 flex flex-col gap-3">
                  {slots.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 font-medium italic text-center">
                      No classes
                    </div>
                  ) : (
                    slots.map((slot, sIdx) => (
                      <div key={sIdx} className="group relative bg-brand-accent/10 border border-brand-accent/20 px-3 py-3 rounded-xl text-center flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                        <span className="text-sm font-bold text-brand-accent">
                          {slot.startTime}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-brand-accent/50 my-0.5">to</span>
                        <span className="text-sm font-bold text-brand-accent mb-1">
                          {slot.endTime}
                        </span>
                        {slot.classId && selectedClasses.find(c => c.id === slot.classId) && (
                          <span className="text-[9px] font-bold text-white bg-brand-accent px-2 py-0.5 rounded-full mt-1 line-clamp-1 truncate w-full max-w-full">
                            {selectedClasses.find(c => c.id === slot.classId).name}
                          </span>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(day, sIdx)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
