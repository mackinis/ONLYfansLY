
// 'use server'; // Removed: This file will no longer contain server actions directly callable by client.
// Its functions will be utility functions for API routes or logic moved to API routes.

import { z } from 'zod';
import type { Testimonial, UserProfile, Video, SiteSettings, SocialLink, Announcement, AnnouncementContentType, HeaderDisplayMode, FooterDisplayMode, ColorSetting, DashboardStats, TestimonialMediaOption, UpdateUserOwnTestimonialData, HeroTaglineSize, ActiveCurrencySetting, ExchangeRates } from './types';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, Timestamp, orderBy, serverTimestamp, deleteDoc, getDoc, setDoc, runTransaction, increment,getCountFromServer } from 'firebase/firestore';
import { sendActivationEmail } from './emailService';
import { defaultThemeColorsHex } from './config';
import { addMinutes, isAfter } from 'date-fns';


function generateAlphanumericToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const testimonialSubmitSchema = z.object({
  author: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(50),
  text: z.string().min(10, { message: 'Testimonial must be at least 10 characters.' }).max(500),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  userId: z.string().min(1, { message: 'User ID is required.' }),
  photoUrlsInput: z.string().optional(),
  videoUrlsInput: z.string().optional(),
});

export async function submitTestimonialLogic(formData: z.infer<typeof testimonialSubmitSchema>) {
  const parsedData = testimonialSubmitSchema.safeParse(formData);

  if (!parsedData.success) {
    console.error('Invalid testimonial data:', parsedData.error.flatten().fieldErrors);
    return { success: false, message: 'Datos de testimonio inválidos.', errors: parsedData.error.flatten().fieldErrors };
  }

  try {
    // Site settings should be fetched by the API route if needed for mediaOptions
    // For now, assuming API route will pass pre-validated/filtered media URLs
    const siteSettings = await getSiteSettingsLogic(); // Call the logic function
    const mediaOptions = siteSettings.testimonialMediaOptions || 'both';


    let photoUrls: string[] = [];
    if ((mediaOptions === 'photos' || mediaOptions === 'both') && parsedData.data.photoUrlsInput) {
      photoUrls = parsedData.data.photoUrlsInput.split(',').map(s => s.trim()).filter(s => s && (s.startsWith('http://') || s.startsWith('https://')));
    }

    let videoUrls: string[] = [];
    if ((mediaOptions === 'videos' || mediaOptions === 'both') && parsedData.data.videoUrlsInput) {
      videoUrls = parsedData.data.videoUrlsInput.split(',').map(s => s.trim()).filter(s => s && (s.startsWith('http://') || s.startsWith('https://')));
    }

    const newTestimonialData = {
      author: parsedData.data.author,
      text: parsedData.data.text,
      email: parsedData.data.email,
      userId: parsedData.data.userId,
      photoUrls: photoUrls,
      videoUrls: videoUrls,
      date: serverTimestamp(),
      status: 'pending' as Testimonial['status'],
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'testimonials'), newTestimonialData);
    return {
      success: true,
      message: 'Testimonio enviado exitosamente.',
      testimonial: {
        id: docRef.id,
        ...parsedData.data,
        photoUrls: newTestimonialData.photoUrls,
        videoUrls: newTestimonialData.videoUrls,
        date: new Date().toISOString(),
        status: 'pending',
        updatedAt: new Date().toISOString(),
      } as Testimonial
    };
  } catch (error) {
    console.error('Error submitting testimonial to Firestore:', error);
    return { success: false, message: 'No se pudo enviar el testimonio debido a un error del servidor.' };
  }
}

export async function getTestimonialsLogic(status?: Testimonial['status'], userId?: string): Promise<Testimonial[]> {
  try {
    const testimonialsCol = collection(db, 'testimonials');
    let conditions = [];
    if (status) {
      conditions.push(where('status', '==', status));
    }
    if (userId) {
      conditions.push(where('userId', '==', userId));
    }

    const q = query(testimonialsCol, ...conditions, orderBy('date', 'desc'));

    const querySnapshot = await getDocs(q);
    const testimonials: Testimonial[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      testimonials.push({
        id: docSnap.id,
        author: data.author,
        text: data.text,
        email: data.email,
        userId: data.userId,
        date: (data.date as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        status: data.status,
        photoUrls: data.photoUrls || [],
        videoUrls: data.videoUrls || [],
        updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || (data.date as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Testimonial);
    });
    return testimonials;
  } catch (error) {
    console.error('Detailed error fetching testimonials from Firestore:', error);
    throw new Error(`Could not fetch testimonials. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updateTestimonialStatusLogic(id: string, status: Testimonial['status']): Promise<Testimonial | null> {
  try {
    const testimonialRef = doc(db, 'testimonials', id);
    await updateDoc(testimonialRef, { status, updatedAt: serverTimestamp() });
    const updatedSnap = await getDoc(testimonialRef);
    if (updatedSnap.exists()) {
        const data = updatedSnap.data();
        return {
            id: updatedSnap.id,
            author: data.author,
            text: data.text,
            email: data.email,
            userId: data.userId,
            date: (data.date as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            status: data.status,
            photoUrls: data.photoUrls || [],
            videoUrls: data.videoUrls || [],
            updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as Testimonial;
    }
    return null;
  } catch (error) {
    console.error(`Error updating testimonial ${id} status in Firestore:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not update testimonial status for ID ${id}. Original error: ${errorMessage}`);
  }
}

export async function deleteTestimonialByIdLogic(testimonialId: string) {
  try {
    const testimonialRef = doc(db, 'testimonials', testimonialId);
    await deleteDoc(testimonialRef);
    return { success: true, message: 'Testimonial deleted successfully.' };
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    return { success: false, message: 'Failed to delete testimonial.' };
  }
}

const updateUserOwnTestimonialSchema = z.object({
  text: z.string().min(10, "Testimonial must be at least 10 characters.").max(500),
  photoUrlsInput: z.string().optional(),
  videoUrlsInput: z.string().optional(),
});

export async function updateUserOwnTestimonialLogic(
  testimonialId: string,
  userId: string,
  data: UpdateUserOwnTestimonialData
) {
  const validation = updateUserOwnTestimonialSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: "Invalid testimonial data.", errors: validation.error.flatten().fieldErrors };
  }

  try {
    const testimonialRef = doc(db, 'testimonials', testimonialId);
    const testimonialSnap = await getDoc(testimonialRef);

    if (!testimonialSnap.exists()) {
      return { success: false, message: "Testimonial not found." };
    }

    const testimonialData = testimonialSnap.data() as Testimonial;

    if (testimonialData.userId !== userId) {
      return { success: false, message: "You are not authorized to edit this testimonial." };
    }

    if (testimonialData.status !== 'pending') {
      return { success: false, message: "This testimonial can no longer be edited as it has already been processed." };
    }

    const siteSettings = await getSiteSettingsLogic();
    const gracePeriodMinutes = siteSettings.testimonialEditGracePeriodMinutes || 0;
    const submissionDate = (testimonialData.date as any instanceof Timestamp)
        ? (testimonialData.date as any as Timestamp).toDate()
        : new Date(testimonialData.date);

    const gracePeriodEndDate = addMinutes(submissionDate, gracePeriodMinutes);

    if (isAfter(new Date(), gracePeriodEndDate)) {
      return { success: false, message: "The editing period for this testimonial has expired." };
    }

    const mediaOptions = siteSettings.testimonialMediaOptions || 'both';
    let photoUrls: string[] = testimonialData.photoUrls || [];
    if ((mediaOptions === 'photos' || mediaOptions === 'both') && validation.data.photoUrlsInput !== undefined) {
      photoUrls = validation.data.photoUrlsInput.split(',').map(s => s.trim()).filter(s => s && (s.startsWith('http://') || s.startsWith('https://')));
    } else if (mediaOptions !== 'photos' && mediaOptions !== 'both') {
      photoUrls = [];
    }

    let videoUrls: string[] = testimonialData.videoUrls || [];
    if ((mediaOptions === 'videos' || mediaOptions === 'both') && validation.data.videoUrlsInput !== undefined) {
      videoUrls = validation.data.videoUrlsInput.split(',').map(s => s.trim()).filter(s => s && (s.startsWith('http://') || s.startsWith('https://')));
    } else if (mediaOptions !== 'videos' && mediaOptions !== 'both') {
      videoUrls = [];
    }

    await updateDoc(testimonialRef, {
      text: validation.data.text,
      photoUrls: photoUrls,
      videoUrls: videoUrls,
      updatedAt: serverTimestamp(),
    });

    return { success: true, message: "Testimonial updated successfully." };

  } catch (error) {
    console.error("Error updating user's own testimonial:", error);
    return { success: false, message: "Failed to update testimonial. Please try again." };
  }
}


export const registerUserSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  surname: z.string().min(2, { message: "El apellido debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor ingresa un email válido." }),
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres." }),
  phone: z.string().min(1, { message: "El teléfono es requerido." }),
  dni: z.string().min(1, { message: "El DNI es requerido." }),
  address: z.string().min(1, { message: "La dirección es requerida." }),
  postalCode: z.string().min(1, { message: "El código postal es requerido." }),
  city: z.string().min(1, { message: "La ciudad es requerida." }),
  province: z.string().min(1, { message: "La provincia es requerida." }),
  country: z.string().min(1, { message: "El país es requerido." }),
});


const adminProfileUpdateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  surname: z.string().min(2, "Surname must be at least 2 characters."),
  avatarUrl: z.string().url({ message: "Avatar URL must be a valid URL." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  dni: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
});

const adminPasswordChangeSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});


export async function registerUserLogic(data: z.infer<typeof registerUserSchema>) {
  const validation = registerUserSchema.safeParse(data);
  if (!validation.success) {
    console.error("Registration data invalid:", validation.error.flatten().fieldErrors);
    return { success: false, message: "Datos de registro inválidos.", errors: validation.error.flatten().fieldErrors };
  }

  const { email, password, ...profileData } = validation.data;

  try {
    const siteSettings = await getSiteSettingsLogic();
    const siteTitle = siteSettings.siteTitle || "Aurum Media";

    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('email', '==', email));
    const existingUserSnapshot = await getDocs(q);
    if (!existingUserSnapshot.empty) {
      return { success: false, message: 'El correo electrónico ya está registrado.' };
    }

    const activationToken = generateAlphanumericToken(24);
    const activationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const passwordHash = password;
    const isAdminEmail = email === process.env.ADMIN_EMAIL;
    const userRole = isAdminEmail ? 'admin' : 'user';

    const newUser: Omit<UserProfile, 'id' | 'testimonialCount'> = {
      ...profileData,
      email,
      passwordHash,
      role: userRole,
      isActive: true,
      isVerified: false,
      activationToken,
      activationTokenExpires,
      canSubmitTestimonial: false,
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(usersCol, {
      ...newUser,
      activationTokenExpires: Timestamp.fromDate(activationTokenExpires),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      testimonialCount: 0,
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1>¡Bienvenido a ${siteTitle}!</h1>
        <p>Gracias por registrarte. Para activar tu cuenta, por favor usa el siguiente token cuando intentes iniciar sesión por primera vez:</p>
        <p>Tu token de activación: <br><strong style="font-size: 1.2em; background-color: #f0f0f0; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${activationToken}</strong></p>
        <p>Este token expirará en 24 horas.</p>
        <p>Si no te registraste en ${siteTitle}, por favor ignora este correo.</p>
        <p>Saludos,<br>El equipo de ${siteTitle}</p>
      </div>
    `;

    const emailResult = await sendActivationEmail(email, `Activa tu cuenta en ${siteTitle}`, emailHtml, siteTitle);

    if (!emailResult.success) {
      console.error(`Failed to send activation email to ${email}:`, emailResult.error);
      return { success: true, message: 'Registro exitoso. Hubo un problema al enviar el correo de activación, por favor intenta reenviar el token desde la página de inicio de sesión.', userId: docRef.id };
    }

    return { success: true, message: 'Registro exitoso. Revisa tu correo para activar tu cuenta.', userId: docRef.id };
  } catch (error) {
    console.error('Error registering user:', error);
    return { success: false, message: 'Error en el servidor durante el registro.' };
  }
}

export async function getUserByEmailForLoginLogic(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('email', '==', email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    return {
      id: userDoc.id,
      ...userData,
      avatarUrl: userData.avatarUrl || '',
      activationTokenExpires: (userData.activationTokenExpires as Timestamp)?.toDate(),
      createdAt: (userData.createdAt as Timestamp)?.toDate(),
      updatedAt: (userData.updatedAt as Timestamp)?.toDate(),
      testimonialCount: userData.testimonialCount || 0,
    } as UserProfile;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }
}

export async function verifyUserActivationTokenLogic(userId: string, token: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { success: false, message: 'Usuario no encontrado.' };
    }
    const userData = userSnap.data() as UserProfile;
    if (userData.isVerified) {
      return { success: true, message: 'La cuenta ya está verificada.' };
    }
    if (userData.activationToken !== token) {
      return { success: false, message: 'Token de activación inválido.' };
    }
    const tokenExpiryDate = userData.activationTokenExpires ? new Date((userData.activationTokenExpires as unknown as Timestamp).seconds * 1000) : null;

    if (!tokenExpiryDate || tokenExpiryDate < new Date()) {
        await updateDoc(userRef, {
            activationToken: null,
            activationTokenExpires: null,
        });
      return { success: false, message: 'El token de activación ha expirado. Solicita uno nuevo.' };
    }
    await updateDoc(userRef, {
      isVerified: true,
      isActive: true,
      canSubmitTestimonial: userData.role === 'user',
      activationToken: null,
      activationTokenExpires: null,
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: 'Cuenta activada exitosamente. Ahora puedes iniciar sesión.' };
  } catch (error) {
    console.error('Error verifying activation token:', error);
    return { success: false, message: 'Error en el servidor durante la activación.' };
  }
}

export async function resendActivationTokenLogic(email: string) {
  try {
    const siteSettings = await getSiteSettingsLogic();
    const siteTitle = siteSettings.siteTitle || "Aurum Media";

    const user = await getUserByEmailForLoginLogic(email);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado con este correo electrónico.' };
    }
    if (user.isVerified) {
      return { success: false, message: 'Esta cuenta ya ha sido verificada.' };
    }
    const newActivationToken = generateAlphanumericToken(24);
    const newActivationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const userRef = doc(db, 'users', user.id);
    await updateDoc(userRef, {
      activationToken: newActivationToken,
      activationTokenExpires: Timestamp.fromDate(newActivationTokenExpires),
      updatedAt: serverTimestamp(),
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1>Reenvío de Token de Activación - ${siteTitle}</h1>
        <p>Has solicitado reenviar tu token de activación. Para activar tu cuenta, por favor usa el siguiente token cuando intentes iniciar sesión por primera vez:</p>
        <p>Tu nuevo token de activación:<br><strong style="font-size: 1.2em; background-color: #f0f0f0; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${newActivationToken}</strong></p>
        <p>Este token expirará en 24 horas.</p>
        <p>Si no solicitaste esto, por favor ignora este correo.</p>        <p>Saludos,<br>El equipo de ${siteTitle}</p>
      </div>
    `;
    const emailResult = await sendActivationEmail(email, `Nuevo Token de Activación - ${siteTitle}`, emailHtml, siteTitle);
    if (!emailResult.success) {
        console.error(`Failed to resend activation email to ${email}:`, emailResult.error);
         return { success: false, message: 'Se generó un nuevo token, pero hubo un problema al enviar el correo. Por favor, inténtalo de nuevo más tarde o contacta a soporte.' };
    }

    return { success: true, message: 'Se ha enviado un nuevo token de activación a tu correo.' };
  } catch (error) {
    console.error('Error resending activation token:', error);
    return { success: false, message: 'Error en el servidor al reenviar el token.' };
  }
}

export async function getAllUsersLogic(): Promise<UserProfile[]> {
  try {
    const usersCol = collection(db, 'users');
    const usersQuery = query(usersCol, orderBy('createdAt', 'desc'));
    const usersSnapshot = await getDocs(usersQuery);
    let users: UserProfile[] = [];

    if (usersSnapshot.empty) {
        return [];
    }

    const testimonialsCol = collection(db, 'testimonials');
    // Fetch all testimonials to count them client-side (can be optimized for very large dbs)
    // or maintain a count on the user document via triggers if performance becomes an issue.
    const testimonialsSnapshot = await getDocs(testimonialsCol);
    const testimonialCounts: Record<string, number> = {};

    testimonialsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.userId) {
            testimonialCounts[data.userId] = (testimonialCounts[data.userId] || 0) + 1;
        }
    });


    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        ...data,
        avatarUrl: data.avatarUrl || '',
        activationTokenExpires: (data.activationTokenExpires as Timestamp)?.toDate(),
        createdAt: (data.createdAt as Timestamp)?.toDate(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate(),
        testimonialCount: testimonialCounts[docSnap.id] || 0,
      } as UserProfile);
    });
    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw new Error('Could not fetch users.');
  }
}

export async function getUserProfileByIdLogic(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return null;
    }
    const userData = userSnap.data();

    const testimonialsCol = collection(db, 'testimonials');
    const q = query(testimonialsCol, where('userId', '==', userId));
    const testimonialsSnapshot = await getDocs(q);
    const testimonialCount = testimonialsSnapshot.size;


    return {
      id: userSnap.id,
      ...userData,
      avatarUrl: userData.avatarUrl || '',
      activationTokenExpires: (userData.activationTokenExpires as Timestamp)?.toDate(),
      createdAt: (userData.createdAt as Timestamp)?.toDate(),
      updatedAt: (userData.updatedAt as Timestamp)?.toDate(),
      testimonialCount: testimonialCount,
    } as UserProfile;
  } catch (error) {
    console.error(`Error fetching user profile by ID ${userId} in getUserProfileByIdLogic:`, error);
    throw new Error(`Failed to fetch user profile for ${userId}. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const userEditableProfileSchema = z.object({
  phone: z.string().min(1, "El teléfono es requerido.").optional().or(z.literal('')),
  address: z.string().min(1, "La dirección es requerida.").optional().or(z.literal('')),
  postalCode: z.string().min(1, "El código postal es requerido.").optional().or(z.literal('')),
  city: z.string().min(1, "La ciudad es requerida.").optional().or(z.literal('')),
  province: z.string().min(1, "La provincia es requerida.").optional().or(z.literal('')),
  country: z.string().min(1, "El país es requerido.").optional().or(z.literal('')),
});

export async function updateUserEditableProfileLogic(userId: string, data: z.infer<typeof userEditableProfileSchema>) {
  const validation = userEditableProfileSchema.safeParse(data);
  if (!validation.success) {
    const errors = validation.error.flatten().fieldErrors;
    const firstErrorMessage = Object.values(errors)[0]?.[0] || "Los datos del perfil son inválidos.";
    return { success: false, message: firstErrorMessage, errors };
  }

  try {
    const userRef = doc(db, 'users', userId);
    const updatePayload: Record<string, any> = { ...validation.data };
    updatePayload.updatedAt = serverTimestamp();

    await updateDoc(userRef, updatePayload);
    return { success: true, message: "Perfil actualizado exitosamente." };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, message: "Error al actualizar el perfil." };
  }
}


export async function updateUserActiveStatusLogic(userId: string, isActive: boolean) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: `User status updated to ${isActive ? 'active' : 'inactive'}.` };
  } catch (error) {
    console.error('Error updating user active status:', error);
    return { success: false, message: 'Failed to update user status.' };
  }
}

export async function updateUserTestimonialPermissionLogic(userId: string, canSubmit: boolean) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      canSubmitTestimonial: canSubmit,
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: `Permiso para enviar testimonios actualizado a ${canSubmit ? 'permitido' : 'denegado'}.` };
  } catch (error) {
    console.error('Error updating user testimonial permission:', error);
    return { success: false, message: 'Error al actualizar el permiso para testimonios.' };
  }
}

export async function getAdminProfileLogic(): Promise<UserProfile | null> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("ADMIN_EMAIL environment variable is not set.");
    return null;
  }
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, where('email', '==', adminEmail), where('role', '==', 'admin'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.warn(`No admin user found with email ${adminEmail}`);
      return null;
    }
    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();
    return {
      id: adminDoc.id,
      ...adminData,
      avatarUrl: adminData.avatarUrl || '',
      activationTokenExpires: (adminData.activationTokenExpires as Timestamp)?.toDate(),
      createdAt: (adminData.createdAt as Timestamp)?.toDate(),
      updatedAt: (adminData.updatedAt as Timestamp)?.toDate(),
      testimonialCount: adminData.testimonialCount || 0,
    } as UserProfile;
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return null;
  }
}

export async function updateAdminProfileLogic(adminId: string, data: z.infer<typeof adminProfileUpdateSchema>) {
  const validation = adminProfileUpdateSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: "Invalid admin profile data.", errors: validation.error.flatten().fieldErrors };
  }
  try {
    const adminRef = doc(db, 'users', adminId);
    await updateDoc(adminRef, {
      ...validation.data,
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: "Admin profile updated successfully." };
  } catch (error) {
    console.error('Error updating admin profile:', error);
    return { success: false, message: "Failed to update admin profile." };
  }
}

export async function updateAdminPasswordLogic(adminId: string, data: z.infer<typeof adminPasswordChangeSchema>) {
  const validation = adminPasswordChangeSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: "Invalid password data.", errors: validation.error.flatten().fieldErrors };
  }
  try {
    const adminRef = doc(db, 'users', adminId);
    const newPasswordHash = data.newPassword;
    await updateDoc(adminRef, {
      passwordHash: newPasswordHash,
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: "Admin password updated successfully." };
  } catch (error) {
    console.error('Error updating admin password:', error);
    return { success: false, message: "Failed to update admin password." };
  }
}

export async function deleteUserByIdLogic(userId: string) {
    try {
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);
        return { success: true, message: 'User deleted successfully.' };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, message: 'Failed to delete user.' };
    }
}

export const videoCourseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  previewImageUrl: z.string().url("Preview Image URL must be a valid URL").optional().or(z.literal('')),
  videoUrl: z.string().url("Video URL must be a valid URL"),
  priceArs: z.coerce.number().positive("Price must be a positive number"),
  discountInput: z.string().optional().or(z.literal('')),
  duration: z.string().optional(),
});

interface PriceCalculationResult {
  finalPrice: number;
  processedDiscountValueForStorage: string | null;
}

function calculateCoursePrices(
  originalPrice: number,
  discountInputValue?: string | null
): PriceCalculationResult {
  let finalPrice = originalPrice;
  let processedDiscountValueForStorage: string | null = null;

  if (discountInputValue && typeof discountInputValue === 'string' && discountInputValue.trim() !== '') {
    const trimmedDiscount = discountInputValue.trim();
    processedDiscountValueForStorage = trimmedDiscount;

    if (trimmedDiscount.endsWith('%')) {
      const percentage = parseFloat(trimmedDiscount.slice(0, -1));
      if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
        finalPrice = originalPrice * (1 - percentage / 100);
      } else {
        processedDiscountValueForStorage = null;
      }
    } else {
      const fixedFinalPrice = parseFloat(trimmedDiscount);
      if (!isNaN(fixedFinalPrice) && fixedFinalPrice >= 0 && fixedFinalPrice < originalPrice) {
        finalPrice = fixedFinalPrice;
      } else {
         if (!(fixedFinalPrice < originalPrice)) {
            processedDiscountValueForStorage = null;
         }
      }
    }
  }
  return { finalPrice: Math.round(finalPrice * 100) / 100, processedDiscountValueForStorage };
}

export async function createVideoCourseLogic(data: z.input<typeof videoCourseSchema>) {
  const validation = videoCourseSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: "Invalid course data.", errors: validation.error.flatten().fieldErrors };
  }
  try {
    const { priceArs, discountInput, ...restOfData } = validation.data;

    const { finalPrice, processedDiscountValueForStorage } = calculateCoursePrices(priceArs, discountInput);

    const coursesCol = collection(db, 'videoCourses');
    const orderQuery = query(coursesCol, orderBy('order', 'desc'), where('order', '>=', 0));
    const orderSnapshot = await getDocs(orderQuery);
    let maxOrder = 0;
    if (!orderSnapshot.empty) {
        const firstDocData = orderSnapshot.docs[0].data();
        if (typeof firstDocData.order === 'number') {
            maxOrder = firstDocData.order;
        }
    }
    const newOrder = maxOrder + 1;

    const docRef = await addDoc(coursesCol, {
      ...restOfData,
      priceArs: priceArs,
      discountInput: processedDiscountValueForStorage,
      finalPriceArs: finalPrice,
      order: newOrder,
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: "Course created successfully.", courseId: docRef.id };
  } catch (error) {
    console.error('Error creating video course:', error);
    return { success: false, message: `Failed to create course: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function getVideoCoursesLogic(): Promise<Video[]> {
  try {
    const coursesCol = collection(db, 'videoCourses');
    const q = query(coursesCol, orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);
    const courses: Video[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      courses.push({
        id: docSnap.id,
        title: data.title,
        description: data.description,
        previewImageUrl: data.previewImageUrl,
        videoUrl: data.videoUrl,
        priceArs: data.priceArs,
        discountInput: data.discountInput,
        finalPriceArs: data.finalPriceArs,
        duration: data.duration,
        order: data.order || 0,
        views: data.views || 0,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Video);
    });
    return courses;
  } catch (error) {
    console.error('Error fetching video courses:', error);
    throw new Error(`Could not fetch video courses. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updateVideoCourseLogic(id: string, data: Partial<z.input<typeof videoCourseSchema>>) {
  const partialSchema = videoCourseSchema.partial();
  const validation = partialSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, message: "Invalid course data for update.", errors: validation.error.flatten().fieldErrors };
  }
  if (Object.keys(validation.data).length === 0) {
    return { success: false, message: "No data provided for update." };
  }

  try {
    const courseRef = doc(db, 'videoCourses', id);
    const currentDocSnap = await getDoc(courseRef);
    if (!currentDocSnap.exists()) {
      return { success: false, message: "Course not found." };
    }
    const currentData = currentDocSnap.data() as Video;

    const updatedPayload: Record<string, any> = { ...validation.data };

    const newPriceArs = data.priceArs !== undefined ? data.priceArs : currentData.priceArs;
    const newDiscountInput = data.discountInput !== undefined ? data.discountInput : currentData.discountInput;

    if (data.priceArs !== undefined || data.discountInput !== undefined) {
      const { finalPrice, processedDiscountValueForStorage } = calculateCoursePrices(newPriceArs, newDiscountInput);
      updatedPayload.priceArs = newPriceArs;
      updatedPayload.discountInput = processedDiscountValueForStorage;
      updatedPayload.finalPriceArs = finalPrice;
    }

    updatedPayload.updatedAt = serverTimestamp();

    await updateDoc(courseRef, updatedPayload);
    return { success: true, message: "Course updated successfully." };
  } catch (error) {
    console.error('Error updating video course:', error);
    return { success: false, message: `Failed to update course: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function deleteVideoCourseLogic(id: string) {
  try {
    const courseRef = doc(db, 'videoCourses', id);
    await deleteDoc(courseRef);
    return { success: true, message: "Course deleted successfully." };
  } catch (error) {
    console.error('Error deleting video course:', error);
    return { success: false, message: `Failed to delete course: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function updateVideoCoursesOrderLogic(courses: Array<{ id: string; order: number }>) {
  try {
    const batch = [];
    for (const course of courses) {
      const courseRef = doc(db, 'videoCourses', course.id);
      batch.push(updateDoc(courseRef, { order: course.order, updatedAt: serverTimestamp() }));
    }
    await Promise.all(batch);
    return { success: true, message: "Courses order updated successfully." };
  } catch (error) {
    console.error('Error updating courses order:', error);
    return { success: false, message: `Failed to update courses order: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function incrementVideoCourseViewsLogic(videoId: string): Promise<{ success: boolean; message?: string }> {
  if (!videoId) {
    return { success: false, message: 'Video ID is required.' };
  }
  try {
    const courseRef = doc(db, 'videoCourses', videoId);
    await updateDoc(courseRef, {
      views: increment(1),
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error(`Error incrementing views for video ${videoId}:`, error);
    return { success: false, message: `Failed to increment views: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}


export async function getVideoCourseByIdLogic(id: string): Promise<Video | null> {
  try {
    const courseRef = doc(db, 'videoCourses', id);
    const docSnap = await getDoc(courseRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        title: data.title,
        description: data.description,
        previewImageUrl: data.previewImageUrl,
        videoUrl: data.videoUrl,
        priceArs: data.priceArs,
        discountInput: data.discountInput,
        finalPriceArs: data.finalPriceArs,
        duration: data.duration,
        order: data.order || 0,
        views: data.views || 0,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Video;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching video course by ID ${id}:`, error);
    throw new Error(`Could not fetch video course. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const siteSettingsDocId = "globalConfig";

const socialLinkSchemaDb = z.object({
  id: z.string(),
  name: z.string().min(1, "Social network name cannot be empty."),
  url: z.string().url("Must be a valid URL.").or(z.literal('')),
  iconName: z.string().optional(),
});

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

const colorSettingSchemaDb = z.object({
  id: z.string(),
  labelKey: z.string(),
  cssVar: z.string(),
  defaultValueHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid 6-digit HEX color"),
  value: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid 6-digit HEX color"),
});

const validTestimonialMediaOptions = ['none', 'photos', 'videos', 'both'] as const;
const validHeroTaglineSizes = ['sm', 'md', 'lg'] as const;

export const siteSettingsInternalSchema = z.object({
  siteTitle: z.string().default("Aurum Media"),
  siteIconUrl: z.string().url().optional().or(z.literal('')).default(""),
  headerIconUrl: z.string().url().optional().or(z.literal('')).default(""),
  maintenanceMode: z.boolean().default(false),
  defaultLanguage: z.enum(['en', 'es']).default('es'),
  allowUserToChooseLanguage: z.boolean().default(true),
  activeCurrencies: z.array(z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    symbol: z.string(),
    isPrimary: z.boolean(),
  })).default([
    { id: "ars", code: "ARS", name: "Argentine Peso", symbol: "AR$", isPrimary: true },
    { id: "usd", code: "USD", name: "US Dollar", symbol: "US$", isPrimary: false },
    { id: "eur", code: "EUR", name: "Euro", symbol: "€", isPrimary: false },
  ]),
  allowUserToChooseCurrency: z.boolean().default(true),
  exchangeRates: z.object({
    usdToArs: z.number().positive().default(1000),
    eurToArs: z.number().positive().default(1100),
  }).default({ usdToArs: 1000, eurToArs: 1100 }),
  themeColors: z.array(colorSettingSchemaDb).default(() => defaultThemeColorsHex.map(c => ({...c}))),
  heroTitle: z.string().default("Descubre Aurum Media"),
  heroSubtitle: z.string().default("Sumérgete en una colección curada de contenido de video premium, diseñado para inspirar y cautivar."),
  heroTagline: z.string().optional().default(""),
  heroTaglineColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid 6-digit HEX color").optional().default("#FFFFFF"),
  heroTaglineSize: z.enum(validHeroTaglineSizes).optional().default('md'),
  liveStreamDefaultTitle: z.string().default("Evento en Vivo"),
  liveStreamOfflineMessage: z.string().default("La transmisión en vivo está actualmente desconectada. ¡Vuelve pronto!"),
  liveStreamAuthorizedUserId: z.string().nullable().optional().default(null),
  persistentSubtitle: z.string().optional(),
  liveStreamForLoggedInUsersOnly: z.boolean().optional().default(false),
  socialLinks: z.array(socialLinkSchemaDb).default([]),
  testimonialMediaOptions: z.enum(validTestimonialMediaOptions).default('both'),
  testimonialEditGracePeriodMinutes: z.coerce.number().int().min(0).default(60),
  updatedAt: z.any().optional(), // Allow Timestamp, Date string, or undefined for parsing flexibility
  whatsAppEnabled: z.boolean().default(false),
  whatsAppPhoneNumber: z.string()
    .refine(value => value === '' || phoneRegex.test(value), {
      message: "Invalid phone number format. Include country code e.g. +1234567890",
    })
    .default(""),
  whatsAppDefaultMessage: z.string().optional().default(""),
  whatsAppIcon: z.string().default('default'),
  whatsAppCustomIconUrl: z.string().url().optional().or(z.literal('')).default(""),
  whatsAppButtonSize: z.number().int().positive().default(56),
  whatsAppIconSize: z.number().int().positive().default(28),
  aiCurationEnabled: z.boolean().default(true),
  aiCurationMinTestimonials: z.number().int().min(0).default(5),
  headerDisplayMode: z.enum(['logo', 'title', 'both']).default('both'),
  footerDisplayMode: z.enum(['logo', 'title', 'both']).default('logo'),
  footerLogoSize: z.number().int().positive().optional().default(64),
  mobileAppsSectionTitle: z.string().optional().default("Nuestras Apps"),
  showMobileAppsSection: z.boolean().optional().default(false),
  showAndroidApp: z.boolean().optional().default(false),
  androidAppLink: z.string().url().optional().or(z.literal('')).default(""),
  androidAppIconUrl: z.string().url({ message: "Android app icon URL must be valid." }).optional().or(z.literal("")).default(""),
  showIosApp: z.boolean().optional().default(false),
  iosAppLink: z.string().url().optional().or(z.literal('')).default(""),
  iosAppIconUrl: z.string().url({ message: "iOS app icon URL must be valid." }).optional().or(z.literal("")).default(""),
});

export const defaultSiteSettingsInput: z.input<typeof siteSettingsInternalSchema> = {
  siteTitle: "Aurum Media",
  siteIconUrl: "",
  headerIconUrl: "",
  maintenanceMode: false,
  defaultLanguage: 'es',
  allowUserToChooseLanguage: true,
  activeCurrencies: [
    { id: "ars", code: "ARS", name: "Argentine Peso", symbol: "AR$", isPrimary: true },
    { id: "usd", code: "USD", name: "US Dollar", symbol: "US$", isPrimary: false },
    { id: "eur", code: "EUR", name: "Euro", symbol: "€", isPrimary: false },
  ],
  allowUserToChooseCurrency: true,
  exchangeRates: { usdToArs: 1000, eurToArs: 1100 },
  themeColors: defaultThemeColorsHex.map(c => ({...c})), // Spread to ensure it's a new array of objects
  heroTitle: "Descubre Aurum Media",
  heroSubtitle: "Sumérgete en una colección curada de contenido de video premium, diseñado para inspirar y cautivar.",
  heroTagline: "",
  heroTaglineColor: "#FFFFFF",
  heroTaglineSize: "md",
  liveStreamDefaultTitle: "Evento en Vivo",
  liveStreamOfflineMessage: "La transmisión en vivo está actualmente desconectada. ¡Vuelve pronto!",
  liveStreamAuthorizedUserId: null,
  liveStreamForLoggedInUsersOnly: false,
  socialLinks: [
    { id: `social-${Date.now()}-fb`, name: 'Facebook', url: '', iconName: 'Facebook' },
    { id: `social-${Date.now()}-ig`, name: 'Instagram', url: '', iconName: 'Instagram' },
  ],
  testimonialMediaOptions: 'both',
  testimonialEditGracePeriodMinutes: 60,
  whatsAppEnabled: false,
  whatsAppPhoneNumber: "",
  whatsAppDefaultMessage: "Hola! Estoy interesado en sus servicios.",
  whatsAppIcon: 'default',
  whatsAppCustomIconUrl: "",
  whatsAppButtonSize: 56,
  whatsAppIconSize: 28,
  aiCurationEnabled: true,
  aiCurationMinTestimonials: 5,
  headerDisplayMode: 'both',
  footerDisplayMode: 'logo',
  footerLogoSize: 64,
  mobileAppsSectionTitle: "Nuestras Apps",
  showMobileAppsSection: false,
  showAndroidApp: false,
  androidAppLink: "",
  androidAppIconUrl: "",
  showIosApp: false,
  iosAppLink: "",
  iosAppIconUrl: "",
  // updatedAt is not part of default input, it's set by server
};

// Helper function to safely convert a potential Timestamp, Date object, or Date string to ISO string
function ensureIsoString(dateValue: any): string {
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate().toISOString();
  }
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }
  if (typeof dateValue === 'string') {
    const d = new Date(dateValue);
    // Check if the string was a valid date representation
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  // Fallback for undefined or other invalid types
  return new Date().toISOString();
}

export async function getSiteSettingsLogic(): Promise<SiteSettings> {
  try {
    const settingsRef = doc(db, 'siteSettings', siteSettingsDocId);
    const docSnap = await getDoc(settingsRef);

    let currentDataFromDbOrDefaults: z.input<typeof siteSettingsInternalSchema>;
    let needsUpdateInDb = false;

    if (docSnap.exists()) {
      // Merge DB data with defaults to ensure all fields are present for parsing
      currentDataFromDbOrDefaults = { ...defaultSiteSettingsInput, ...docSnap.data() };
    } else {
      currentDataFromDbOrDefaults = { ...defaultSiteSettingsInput }; // Use a fresh copy of defaults
      needsUpdateInDb = true;
    }

    // Validate and fill missing fields based on schema defaults before specific checks
    // This parse ensures 'currentData' has all schema-defined fields with their defaults if missing
    let preProcessedData = siteSettingsInternalSchema.parse(currentDataFromDbOrDefaults);


    // Specific checks and potential modifications that might trigger a DB update
    if (!preProcessedData.themeColors || preProcessedData.themeColors.length !== defaultThemeColorsHex.length ||
        !preProcessedData.themeColors.every((c: ColorSetting) => defaultThemeColorsHex.find(dc => dc.id === c.id && /^#[0-9A-Fa-f]{6}$/.test(c.value)))) {
      preProcessedData.themeColors = defaultThemeColorsHex.map(c => ({...c})); // Reset to defaults if structure is wrong
      needsUpdateInDb = true;
    }

    if (!Array.isArray(preProcessedData.socialLinks)) {
      preProcessedData.socialLinks = defaultSiteSettingsInput.socialLinks || [];
      needsUpdateInDb = true;
    }
    preProcessedData.socialLinks = preProcessedData.socialLinks.map((link, index) => {
      if (!link.id) needsUpdateInDb = true;
      return {
        id: link.id || `social-${Date.now()}-${index}`,
        ...link,
      };
    });
    
    // Add other specific field checks and default assignments here if necessary, comparing against preProcessedData
    // For example:
    if (typeof preProcessedData.footerLogoSize !== 'number' || preProcessedData.footerLogoSize <= 0) {
        preProcessedData.footerLogoSize = defaultSiteSettingsInput.footerLogoSize;
        needsUpdateInDb = true;
    }
    // ... (add similar checks for other fields that might have been introduced or changed format)

    if (needsUpdateInDb) {
        const dataToSetInDb = { ...preProcessedData, updatedAt: serverTimestamp() };
        // Remove updatedAt before passing to siteSettingsInternalSchema.parse if it's already a serverTimestamp
        const parseableData = { ...dataToSetInDb };
        delete parseableData.updatedAt; 
        const validatedDataToSet = siteSettingsInternalSchema.parse(parseableData); // Re-parse without serverTimestamp for schema validation of values
        await setDoc(settingsRef, { ...validatedDataToSet, updatedAt: serverTimestamp() });
        console.log("Site settings initialized or updated with defaults in Firestore.");
        // After setting, re-fetch or use what was set for the return value's updatedAt
        preProcessedData.updatedAt = new Date(); // Simulate serverTimestamp for immediate use
    }
    
    // Final processing for return, ensuring all fields conform to SiteSettings type (e.g., string dates)
    return {
      ...preProcessedData,
      updatedAt: ensureIsoString(preProcessedData.updatedAt),
    };

  } catch (error) {
    console.error('Error fetching or creating site settings in getSiteSettingsLogic:', error);
    try {
        const parsedFallback = siteSettingsInternalSchema.parse(defaultSiteSettingsInput);
        return {
            ...parsedFallback,
            siteTitle: parsedFallback.siteTitle || "Aurum Media (Fallback)",
            themeColors: parsedFallback.themeColors && parsedFallback.themeColors.length > 0
                         ? parsedFallback.themeColors
                         : defaultThemeColorsHex.map(c=>({...c, value: c.defaultValueHex })),
            socialLinks: (parsedFallback.socialLinks || []).map((link, index) => ({
                id: link.id || `social-fallback-${Date.now()}-${index}`,
                ...link,
            })),
            activeCurrencies: parsedFallback.activeCurrencies && parsedFallback.activeCurrencies.length > 0
                              ? parsedFallback.activeCurrencies.map((c, idx) => ({...c, id: c.id || `curr-fallback-${Date.now()}-${idx}`}))
                              : [{ id: "ars", code: "ARS", name: "Argentine Peso", symbol: "AR$", isPrimary: true }],
            updatedAt: ensureIsoString(undefined), // Will use new Date()
        };
    } catch (parseError) {
        console.error("CRITICAL: Failed to parse defaultSiteSettingsInput in fallback logic of getSiteSettingsLogic:", parseError);
        return {
            siteTitle: "Aurum Media (Critical Fallback)",
            maintenanceMode: true,
            defaultLanguage: 'es',
            allowUserToChooseLanguage: false,
            allowUserToChooseCurrency: false,
            activeCurrencies: [{ id: "ars", code: "ARS", name: "Argentine Peso", symbol: "AR$", isPrimary: true }],
            exchangeRates: { usdToArs: 1000, eurToArs: 1100 },
            themeColors: defaultThemeColorsHex.map(c => ({ ...c, value: c.defaultValueHex })),
            heroTitle: "Site Currently Unavailable",
            heroSubtitle: "Please check back later.",
            liveStreamDefaultTitle: "Live Stream Offline",
            liveStreamOfflineMessage: "The live stream is currently offline.",
            liveStreamAuthorizedUserId: null,
            liveStreamForLoggedInUsersOnly: false,
            socialLinks: [],
            testimonialMediaOptions: 'none',
            testimonialEditGracePeriodMinutes: 0,
            updatedAt: new Date().toISOString(),
            whatsAppEnabled: false,
            whatsAppPhoneNumber: '',
            whatsAppButtonSize: 56,
            whatsAppIconSize: 28,
            whatsAppIcon: 'default',
            whatsAppCustomIconUrl: '',
            aiCurationEnabled: false,
            aiCurationMinTestimonials: 9999,
            headerDisplayMode: 'title',
            footerDisplayMode: 'title',
            footerLogoSize: 32,
            heroTagline: '',
            heroTaglineColor: '#FFFFFF',
            heroTaglineSize: 'md',
            mobileAppsSectionTitle: "Our Apps",
            showMobileAppsSection: false,
            showAndroidApp: false,
            androidAppLink: "",
            androidAppIconUrl: "",
            showIosApp: false,
            iosAppLink: "",
            iosAppIconUrl: "",
            siteIconUrl: "",
            headerIconUrl: ""
        };
    }
  }
}

export async function updateSiteSettingsLogic(data: Partial<Omit<SiteSettings, 'updatedAt' | 'socialLinks' | 'themeColors'> & { socialLinks?: SocialLink[], themeColors?: ColorSetting[], activeCurrencies?: ActiveCurrencySetting[], exchangeRates?: ExchangeRates }>) {
  if (Object.keys(data).length === 0) {
    return { success: false, message: "No settings data provided for update." };
  }

  try {
    const settingsRef = doc(db, 'siteSettings', siteSettingsDocId);
    const updateData: Record<string, any> = { ...data };

    if (data.liveStreamForLoggedInUsersOnly === true && data.liveStreamAuthorizedUserId !== null) {
      // If "logged in users only" is being turned ON, and a specific user was authorized,
      // we should clear the specific user authorization.
      updateData.liveStreamAuthorizedUserId = null;
    } else if (data.liveStreamAuthorizedUserId !== undefined && data.liveStreamAuthorizedUserId !== null) {
      // If a specific user is being authorized, ensure "logged in users only" is turned OFF.
      updateData.liveStreamForLoggedInUsersOnly = false;
    }


    if (data.exchangeRates) {
        updateData.exchangeRates = {
            usdToArs: Number(data.exchangeRates.usdToArs) || defaultSiteSettingsInput.exchangeRates.usdToArs,
            eurToArs: Number(data.exchangeRates.eurToArs) || defaultSiteSettingsInput.exchangeRates.eurToArs,
        };
    }
    if (data.whatsAppButtonSize) updateData.whatsAppButtonSize = Number(data.whatsAppButtonSize);
    if (data.whatsAppIconSize) updateData.whatsAppIconSize = Number(data.whatsAppIconSize);
    if (data.aiCurationMinTestimonials !== undefined) {
      const minTestimonials = Number(data.aiCurationMinTestimonials);
      updateData.aiCurationMinTestimonials = isNaN(minTestimonials) || minTestimonials < 0 ? defaultSiteSettingsInput.aiCurationMinTestimonials : minTestimonials;
    }
     if (data.footerLogoSize !== undefined) {
      const logoSize = Number(data.footerLogoSize);
      updateData.footerLogoSize = isNaN(logoSize) || logoSize <= 0 ? defaultSiteSettingsInput.footerLogoSize : logoSize;
    }
    if (data.testimonialEditGracePeriodMinutes !== undefined) {
      const gracePeriod = Number(data.testimonialEditGracePeriodMinutes);
      updateData.testimonialEditGracePeriodMinutes = isNaN(gracePeriod) || gracePeriod < 0 ? defaultSiteSettingsInput.testimonialEditGracePeriodMinutes : gracePeriod;
    }
    if (data.heroTaglineColor && !/^#[0-9A-Fa-f]{6}$/.test(data.heroTaglineColor)) {
        updateData.heroTaglineColor = defaultSiteSettingsInput.heroTaglineColor;
    }
    if (data.liveStreamAuthorizedUserId !== undefined) {
        updateData.liveStreamAuthorizedUserId = data.liveStreamAuthorizedUserId;
    }
    if (data.liveStreamForLoggedInUsersOnly !== undefined) {
      updateData.liveStreamForLoggedInUsersOnly = data.liveStreamForLoggedInUsersOnly;
    }


    if (data.activeCurrencies && Array.isArray(data.activeCurrencies)) {
      updateData.activeCurrencies = data.activeCurrencies.map((currency, index) => ({
        ...currency,
        id: currency.id || `currency-id-${Date.now()}-${index}`, // Ensure ID
      }));
    } else if (data.hasOwnProperty('activeCurrencies') && !Array.isArray(data.activeCurrencies)) {
        delete updateData.activeCurrencies; // Remove if invalid format
    }


    if (data.socialLinks && Array.isArray(data.socialLinks)) {
      updateData.socialLinks = data.socialLinks.map((link, index) => ({
        id: link.id || `new-social-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
        name: link.name || '',
        url: link.url || '',
        iconName: link.iconName || '',
      })).filter(link => link.name.trim() !== '' || link.url.trim() !== '');
    }
    if (data.themeColors && Array.isArray(data.themeColors)) {
      updateData.themeColors = data.themeColors.map(tc => ({
          id: tc.id,
          labelKey: tc.labelKey,
          cssVar: tc.cssVar,
          defaultValueHex: tc.defaultValueHex,
          value: /^#[0-9A-Fa-f]{6}$/.test(tc.value) ? tc.value : tc.defaultValueHex,
      }));
    }

    if (data.testimonialMediaOptions && validTestimonialMediaOptions.includes(data.testimonialMediaOptions as any)) {
        updateData.testimonialMediaOptions = data.testimonialMediaOptions;
    } else if (data.hasOwnProperty('testimonialMediaOptions')) {
        updateData.testimonialMediaOptions = defaultSiteSettingsInput.testimonialMediaOptions;
    }

    if (data.heroTaglineSize && validHeroTaglineSizes.includes(data.heroTaglineSize as any)) {
        updateData.heroTaglineSize = data.heroTaglineSize;
    } else if (data.hasOwnProperty('heroTaglineSize')) {
        updateData.heroTaglineSize = defaultSiteSettingsInput.heroTaglineSize;
    }
    if (data.showMobileAppsSection !== undefined) updateData.showMobileAppsSection = Boolean(data.showMobileAppsSection);
    if (data.showAndroidApp !== undefined) updateData.showAndroidApp = Boolean(data.showAndroidApp);
    if (data.showIosApp !== undefined) updateData.showIosApp = Boolean(data.showIosApp);

    if (data.androidAppLink !== undefined) {
        updateData.androidAppLink = data.androidAppLink && z.string().url().safeParse(data.androidAppLink).success ? data.androidAppLink : "";
    }
     if (data.androidAppIconUrl !== undefined) {
        updateData.androidAppIconUrl = data.androidAppIconUrl && z.string().url().safeParse(data.androidAppIconUrl).success ? data.androidAppIconUrl : "";
    }
    if (data.iosAppLink !== undefined) {
        updateData.iosAppLink = data.iosAppLink && z.string().url().safeParse(data.iosAppLink).success ? data.iosAppLink : "";
    }
    if (data.iosAppIconUrl !== undefined) {
        updateData.iosAppIconUrl = data.iosAppIconUrl && z.string().url().safeParse(data.iosAppIconUrl).success ? data.iosAppIconUrl : "";
    }

    updateData.updatedAt = serverTimestamp();

    await setDoc(settingsRef, updateData, { merge: true });

    const updatedSettingsSnap = await getDoc(settingsRef);
    let fullUpdatedSettings: SiteSettings;

    if (updatedSettingsSnap.exists()) {
        const updatedDataFromDb = updatedSettingsSnap.data();
        const mergedData = { ...defaultSiteSettingsInput, ...updatedDataFromDb };
        
        // Re-ensure all nested structures are correctly formatted before final parsing
        if (!Array.isArray(mergedData.socialLinks)) {
            mergedData.socialLinks = defaultSiteSettingsInput.socialLinks || [];
        }
        mergedData.socialLinks = mergedData.socialLinks.map((link, index) => ({
          id: link.id || `db-social-${Date.now()}-${index}`,
          ...link,
        }));

        if (!Array.isArray(mergedData.themeColors) || mergedData.themeColors.length === 0) {
            mergedData.themeColors = defaultThemeColorsHex.map(c=>({...c}));
        } else {
             const dbColorsMap = new Map(mergedData.themeColors.map((c: ColorSetting) => [c.id, c]));
             mergedData.themeColors = defaultThemeColorsHex.map(defaultColor => {
                 const dbColor = dbColorsMap.get(defaultColor.id);
                 return {
                     ...defaultColor,
                     value: dbColor?.value && /^#[0-9A-Fa-f]{6}$/.test(dbColor.value) ? dbColor.value : defaultColor.defaultValueHex,
                 };
             });
        }
        
        // Add similar re-ensure logic for other complex fields if needed

        const parsedData = siteSettingsInternalSchema.parse(mergedData);
        fullUpdatedSettings = {
            ...parsedData,
            updatedAt: ensureIsoString(parsedData.updatedAt),
        };
    } else {
        // This case should ideally not be reached if setDoc worked, but as a failsafe:
        const parsedData = siteSettingsInternalSchema.parse(updateData); // Parse the data we attempted to write
         fullUpdatedSettings = {
            ...defaultSiteSettingsInput, // Ensure all defaults
            ...parsedData, // Overlay with our successfully parsed update data
            updatedAt: new Date().toISOString(), // Since DB fetch failed, use current time
        };
    }
    return { success: true, message: "Site settings updated successfully.", updatedSettings: fullUpdatedSettings };

  } catch (error) {
    console.error('Error updating site settings:', error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Invalid data provided for site settings.", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: `Failed to update site settings: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}


export const announcementSchemaBase = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters." }),
  contentType: z.enum(['image-only', 'text-image', 'text-video', 'video-only']),
  text: z.string().optional(),
  imageUrl: z.string().url({ message: "Please enter a valid URL for the image." }).optional().or(z.literal('')),
  videoUrl: z.string().url({ message: "Please enter a valid URL for the video." }).optional().or(z.literal('')),
  expiryDate: z.date({
    required_error: "Expiry date is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  isActive: z.boolean().default(true),
  showOnce: z.boolean().default(false).optional(),
});

export const announcementSchema = announcementSchemaBase.superRefine((data, ctx) => {
  if (data.contentType === 'image-only' && !data.imageUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image URL is required for 'Image only' type.", path: ['imageUrl'] });
  }
  if (data.contentType === 'video-only' && !data.videoUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Video URL is required for 'Video only' type.", path: ['videoUrl'] });
  }
  if (data.contentType === 'text-image') {
    if (!data.text) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text is required for 'Text + Image' type.", path: ['text'] });
    if (!data.imageUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image URL is required for 'Text + Image' type.", path: ['imageUrl'] });
  }
  if (data.contentType === 'text-video') {
    if (!data.text) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Text is required for 'Text + Video' type.", path: ['text'] });
    if (!data.videoUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Video URL is required for 'Text + Video' type.", path: ['videoUrl'] });
  }
});


export async function createAnnouncementLogic(data: z.infer<typeof announcementSchema>) {
  const validation = announcementSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, message: "Invalid announcement data.", errors: validation.error.flatten().fieldErrors };
  }
  try {
    const docRef = await addDoc(collection(db, 'announcements'), {
      ...validation.data,
      showOnce: validation.data.showOnce ?? false,
      expiryDate: Timestamp.fromDate(validation.data.expiryDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: "Announcement created successfully.", announcementId: docRef.id };
  } catch (error) {
    console.error('Error creating announcement:', error);
    return { success: false, message: `Failed to create announcement: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function getAnnouncementsLogic(filters?: { activeOnly?: boolean, nonExpiredOnly?: boolean }): Promise<Announcement[]> {
  try {
    const announcementsCol = collection(db, 'announcements');
    let conditions = [];
    if (filters?.activeOnly) {
      conditions.push(where('isActive', '==', true));
    }
    if (filters?.nonExpiredOnly) {
      conditions.push(where('expiryDate', '>=', Timestamp.now()));
    }

    const q = query(announcementsCol, ...conditions, orderBy('updatedAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const announcements: Announcement[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      announcements.push({
        id: docSnap.id,
        title: data.title,
        contentType: data.contentType,
        text: data.text,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        expiryDate: (data.expiryDate as Timestamp)?.toDate().toISOString(),
        isActive: data.isActive,
        showOnce: data.showOnce ?? false,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Announcement);
    });
    return announcements;
  } catch (error) {
    console.error('Error fetching announcements:', error);
    throw new Error(`Could not fetch announcements. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}


export async function updateAnnouncementLogic(id: string, data: Partial<Omit<z.input<typeof announcementSchemaBase>, 'expiryDate'> & { expiryDate?: Date | string }>) {
  try {
    const announcementRef = doc(db, 'announcements', id);
    const currentDocSnap = await getDoc(announcementRef);
    if (!currentDocSnap.exists()) {
      return { success: false, message: "Announcement not found." };
    }
    const currentData = currentDocSnap.data();

    const mergedInputData: any = { ...currentData, ...data };

    if (mergedInputData.expiryDate && mergedInputData.expiryDate instanceof Timestamp) {
        mergedInputData.expiryDate = mergedInputData.expiryDate.toDate();
    } else if (data.expiryDate && typeof data.expiryDate === 'string') {
        mergedInputData.expiryDate = new Date(data.expiryDate);
    } else if (data.expiryDate && data.expiryDate instanceof Date) {
        mergedInputData.expiryDate = data.expiryDate;
    }

    if (data.showOnce !== undefined) {
        mergedInputData.showOnce = data.showOnce;
    } else if (currentData.showOnce === undefined) {
        mergedInputData.showOnce = false;
    }


    const validation = announcementSchema.safeParse(mergedInputData);

    if (!validation.success) {
      return { success: false, message: "Invalid announcement data for update.", errors: validation.error.flatten().fieldErrors };
    }

    const updatePayload: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (key === 'expiryDate' && validation.data.expiryDate) {
          updatePayload[key] = Timestamp.fromDate(validation.data.expiryDate);
        } else if (key === 'showOnce') {
          updatePayload[key] = validation.data.showOnce ?? false;
        } else if (key !== 'expiryDate') {
           // @ts-ignore
           updatePayload[key] = validation.data[key];
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return { success: false, message: "No data provided for update." };
    }

    updatePayload.updatedAt = serverTimestamp();

    await updateDoc(announcementRef, updatePayload);
    return { success: true, message: "Announcement updated successfully." };
  } catch (error) {
    console.error('Error updating announcement:', error);
    if (error instanceof z.ZodError) {
        return { success: false, message: "Validation error during update preparation.", errors: error.flatten().fieldErrors };
    }
    return { success: false, message: `Failed to update announcement: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}


export async function deleteAnnouncementLogic(id: string) {
  try {
    const announcementRef = doc(db, 'announcements', id);
    await deleteDoc(announcementRef);
    return { success: true, message: "Announcement deleted successfully." };
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return { success: false, message: `Failed to delete announcement: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

async function getCollectionCount(collectionName: string, conditions: any[] = []): Promise<number> {
  try {
    const collRef = collection(db, collectionName);
    let q;
    if (conditions.length > 0) {
        q = query(collRef, ...conditions);
    } else {
        q = query(collRef);
    }
    const snapshot = await getCountFromServer(q); // Use getCountFromServer
    return snapshot.data().count;
  } catch (error) {
    console.error(`Error counting documents in ${collectionName}:`, error);
    return 0;
  }
}
export async function getDashboardStatsLogic(): Promise<DashboardStats> {
  try {
    const [totalCourses, pendingTestimonials, activeUsers, totalUsers] = await Promise.all([
      getCollectionCount('videoCourses'),
      getCollectionCount('testimonials', [where('status', '==', 'pending')]),
      getCollectionCount('users', [where('isActive', '==', true), where('role', '!=', 'admin')]),
      getCollectionCount('users', [where('role', '!=', 'admin')])
    ]);

    return {
      totalCourses,
      pendingTestimonials,
      activeUsers,
      totalUsers
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalCourses: 0,
      pendingTestimonials: 0,
      activeUsers: 0,
      totalUsers: 0
    };
  }
}