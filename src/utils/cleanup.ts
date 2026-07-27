import { collection, query, where, getDocs, deleteDoc, doc, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

// 24 hours in milliseconds
const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const cleanupOldRooms = async () => {
  try {
    const expiredTime = Date.now() - ROOM_EXPIRY_MS;
    const roomsRef = collection(db, 'rooms');
    
    // Find rooms older than 24 hours (limit to 10 to avoid huge batches)
    const q = query(
      roomsRef,
      where('createdAt', '<', expiredTime),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    // Delete the abandoned rooms
    const deletePromises = snapshot.docs.map(async (roomDoc) => {
      // Best effort: Try to clean up subcollections to reclaim space
      try {
        const membersRef = collection(db, `rooms/${roomDoc.id}/members`);
        const membersSnap = await getDocs(membersRef);
        membersSnap.docs.forEach(member => deleteDoc(member.ref).catch(() => {}));
        
        const reactionsRef = collection(db, `rooms/${roomDoc.id}/reactions`);
        const reactionsSnap = await getDocs(reactionsRef);
        reactionsSnap.docs.forEach(reaction => deleteDoc(reaction.ref).catch(() => {}));
      } catch (e) {
        // Ignore subcollection deletion errors
      }
      
      // Delete the main room document
      return deleteDoc(doc(db, 'rooms', roomDoc.id));
    });

    await Promise.allSettled(deletePromises);
    console.log(`Cleaned up ${snapshot.docs.length} abandoned rooms.`);
  } catch (err) {
    console.error('Error cleaning up old rooms:', err);
  }
};
