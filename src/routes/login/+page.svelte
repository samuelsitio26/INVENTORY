<script>
	import { goto } from '$app/navigation';
	import { writable } from 'svelte/store';
	import { initializeApp } from 'firebase/app';
	import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

	// State
	let email = '';
	let password = '';
	let loading = false;
	let error = '';

	// Store user info
	const user = writable(null);

	// Firebase configuration
	const firebaseConfig = {
		apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
		authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
		projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
		storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
		appId: import.meta.env.VITE_FIREBASE_APP_ID
	};

	// Initialize Firebase
	const app = initializeApp(firebaseConfig);
	const auth = getAuth(app);

	async function loginUser() {
		loading = true;
		error = '';
		try {
			// Login dengan Firebase Authentication
			const userCredential = await signInWithEmailAndPassword(auth, email, password);
			const firebaseUser = userCredential.user;

			console.log('Firebase login success:', firebaseUser);

			// Simpan data user ke store dan localStorage
			const userData = {
				token: await firebaseUser.getIdToken(), // Firebase ID Token
				email: firebaseUser.email,
				uid: firebaseUser.uid,
				nama_lengkap: firebaseUser.displayName || email.split('@')[0],
				role: 'manager_dept' // Default role, bisa disesuaikan dengan custom claims
			};

			user.set(userData);
			localStorage.setItem('user_token', userData.token);
			localStorage.setItem('user_email', userData.email);
			localStorage.setItem('user_uid', userData.uid);
			localStorage.setItem('user_nama_lengkap', userData.nama_lengkap);
			localStorage.setItem('user_role', userData.role);

			// Redirect ke dashboard
			goto('/dashboard');
		} catch (e) {
			console.error('Firebase login error:', e);

			// Handle Firebase Auth errors
			switch (e.code) {
				case 'auth/user-not-found':
					error = 'Email tidak terdaftar';
					break;
				case 'auth/wrong-password':
					error = 'Password salah';
					break;
				case 'auth/invalid-email':
					error = 'Format email tidak valid';
					break;
				case 'auth/user-disabled':
					error = 'Akun dinonaktifkan';
					break;
				case 'auth/too-many-requests':
					error = 'Terlalu banyak percobaan login. Coba lagi nanti';
					break;
				default:
					error = e.message || 'Login gagal';
			}
		} finally {
			loading = false;
		}
	}
</script>

<div
	class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-200 via-purple-100 to-pink-200 relative overflow-hidden"
>
	<!-- Decorative animated background shapes -->
	<div class="absolute inset-0 pointer-events-none z-0">
		<!-- Large blurred circles -->
		<div
			class="absolute top-[-80px] left-[-80px] w-72 h-72 bg-blue-300 rounded-full opacity-30 blur-3xl animate-pulse-slow"
		></div>
		<div
			class="absolute bottom-[-100px] right-[-100px] w-96 h-96 bg-pink-300 rounded-full opacity-30 blur-3xl animate-pulse-slow"
		></div>
		<div
			class="absolute top-1/2 left-[-60px] w-40 h-40 bg-purple-300 rounded-full opacity-20 blur-2xl animate-float"
		></div>
		<!-- Glassmorphism wave -->
		<svg class="absolute bottom-0 left-0 w-full h-40 opacity-40" viewBox="0 0 1440 320"
			><path
				fill="#a5b4fc"
				fill-opacity="0.4"
				d="M0,224L48,197.3C96,171,192,117,288,117.3C384,117,480,171,576,197.3C672,224,768,224,864,197.3C960,171,1056,117,1152,101.3C1248,85,1344,107,1392,117.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
			></path></svg
		>
	</div>
	<form
		class="relative z-10 bg-white/90 p-10 rounded-2xl shadow-2xl w-full max-w-md border border-blue-100 backdrop-blur-md"
		on:submit|preventDefault={loginUser}
	>
		<div class="flex flex-col items-center mb-6">
			<img src="/Logo-Eltama-Prima-Indo-01.png" alt="Logo" class="w-16 h-16 mb-2 drop-shadow-lg" />
			<h2 class="text-3xl font-extrabold text-primary mb-1 tracking-tight">INVENTORY LOGIN</h2>
			<p class="text-gray-500 text-sm text-center">
				Sistem Maintenance & Inventory<br />PT Eltama Prima Indo
			</p>
		</div>
		{#if error}
			<div class="bg-red-100 text-red-700 px-3 py-2 rounded mb-4 text-sm text-center">{error}</div>
		{/if}
		<div class="mb-4">
			<label class="block text-gray-700 mb-1 font-medium" for="email">Email</label>
			<input
				id="email"
				class="w-full px-3 py-2 border rounded focus:outline-primary focus:ring-2 focus:ring-primary/30 transition"
				type="email"
				bind:value={email}
				required
				autocomplete="email"
				placeholder="Masukkan email"
			/>
		</div>
		<div class="mb-6">
			<label class="block text-gray-700 mb-1 font-medium" for="password">Password</label>
			<input
				id="password"
				class="w-full px-3 py-2 border rounded focus:outline-primary focus:ring-2 focus:ring-primary/30 transition"
				type="password"
				bind:value={password}
				required
				autocomplete="current-password"
				placeholder="Masukkan password"
			/>
		</div>
		<button
			type="submit"
			class="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-blue-800 transition disabled:opacity-60"
			disabled={loading}
		>
			{#if loading}
				<span
					class="animate-spin inline-block mr-2 border-2 border-white border-t-transparent rounded-full w-4 h-4 align-middle"
				></span>Loading...
			{:else}
				Login
			{/if}
		</button>
		<div class="mt-6 text-xs text-gray-400 text-center">
			&copy; {new Date().getFullYear()} PT Eltama Prima Indo
		</div>
	</form>
</div>

<style>
	@keyframes pulse-slow {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(1.08);
		}
	}
	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-20px);
		}
	}
	.animate-pulse-slow {
		animation: pulse-slow 6s ease-in-out infinite;
	}
	.animate-float {
		animation: float 7s ease-in-out infinite;
	}
</style>
