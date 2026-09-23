import React, { Suspense } from 'react';
import NewAppointmentClient from '@/components/NewAppointmentClient';
import SayText from '@/components/SayText';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}><SayText text="Book Appointment" /></h1>
      <Suspense fallback={<div><SayText text="Loading..." /></div>}>
        <NewAppointmentClient />
      </Suspense>
    </>
  );
}
