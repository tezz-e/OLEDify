"""
Empirical Mathematical Physics & DSP Verification Harness for OLED Studio Design Blueprint.
Author: Challenger 2 (Mathematical Physics & Interaction Challenger)
Date: 2026-10-04
"""

import math
import numpy as np

def test_skiper_gooey_math():
    print("=== 1. SKIPER UI GOOEY FILTER MATHEMATICAL VERIFICATION ===")
    # 4x5 colorMatrix alpha row: [0, 0, 0, 19, -9]
    # alpha_out = clamp(19 * alpha_in - 9, 0, 1)
    
    # 1. Exact Cutoffs
    alpha_zero = 9 / 19
    alpha_one = 10 / 19
    print(f"Alpha zero cutoff: 9/19 = {alpha_zero:.10f}")
    print(f"Alpha one cutoff:  10/19 = {alpha_one:.10f}")
    print(f"Transition span Delta_alpha: {alpha_one - alpha_zero:.10f} (approx {100/19:.4f}%)")
    
    assert math.isclose(19 * alpha_zero - 9, 0.0, abs_tol=1e-12)
    assert math.isclose(19 * alpha_one - 9, 1.0, abs_tol=1e-12)
    
    # Check derivative in active region
    d_alpha = 19.0
    print(f"Active slope d(alpha_out)/d(alpha_in): {d_alpha}")
    
    # 2. Gaussian blur bridge simulation
    # Two circles of radius R=16px separated by center distance D, blurred with sigma=7px (from SvgFilters.tsx stdDeviation=7)
    sigma = 7.0
    # Simulate 1D cross-section between two discs
    xs = np.linspace(-40, 40, 2000)
    dx = xs[1] - xs[0]
    
    # Test coalescence threshold for two point-sources or discs
    # Discs at -D/2 and +D/2
    coalesce_distances = []
    for D in np.linspace(10, 40, 301):
        # Discs of radius 10px centered at -D/2 and +D/2
        disc1 = np.where(np.abs(xs - (-D/2)) <= 8, 1.0, 0.0)
        disc2 = np.where(np.abs(xs - (+D/2)) <= 8, 1.0, 0.0)
        shape = np.maximum(disc1, disc2)
        
        # Gaussian kernel with stdDeviation=7
        kernel_x = np.arange(-5 * sigma, 5 * sigma + dx, dx)
        kernel = np.exp(-0.5 * (kernel_x / sigma) ** 2)
        kernel /= np.sum(kernel)
        
        blurred = np.convolve(shape, kernel, mode='same')
        goo_alpha = np.clip(19 * blurred - 9, 0, 1)
        
        # Check midpoint between pills (x=0)
        mid_idx = np.argmin(np.abs(xs))
        mid_alpha = goo_alpha[mid_idx]
        if mid_alpha > 0.0:
            coalesce_distances.append((D, mid_alpha, blurred[mid_idx]))
            
    if coalesce_distances:
        max_bridge_D = max(d[0] for d in coalesce_distances)
        print(f"Max distance D for bridge formation (pill radius 8px, sigma 7px): D <= {max_bridge_D:.2f}px")
        # Pill edge gap: gap = D - 2*8
        print(f"Max edge-to-edge gap for bridge formation: {max_bridge_D - 16:.2f}px")
    
    print("Skiper UI math verified: Thresholding sharpens the Gaussian tail from smooth decay to a 5.26% step transition.")
    return True

def test_dock_magnification_kernel():
    print("\n=== 2. 21ST.DEV DOCK MAGNIFICATION KERNEL VERIFICATION ===")
    # Kernel: s(d) = 1 + (M - 1) * cos^2(pi * d / (2 * R)) for d <= R, else 1
    M = 1.8  # Max magnification factor
    R = 80.0 # Activation radius in px
    
    # Test boundary continuity at d = R
    d_left = R - 1e-7
    d_right = R + 1e-7
    
    s_at_R = 1 + (M - 1) * (math.cos(math.pi * R / (2 * R))) ** 2
    s_outside = 1.0
    print(f"s(R^-) = {s_at_R:.10f}, s(R^+) = {s_outside:.10f} -> C0 continuous: {math.isclose(s_at_R, s_outside, abs_tol=1e-9)}")
    
    # First derivative:
    # ds/dd = -(M - 1) * (pi / (2*R)) * sin(pi * d / R)
    ds_left = -(M - 1) * (math.pi / (2 * R)) * math.sin(math.pi * (R - 1e-9) / R)
    ds_right = 0.0
    print(f"s'(R^-) = {ds_left:.10e}, s'(R^+) = {ds_right:.10e} -> C1 continuous: {math.isclose(ds_left, ds_right, abs_tol=1e-8)}")
    
    # Second derivative:
    # d2s/dd2 = -(M - 1) * (pi^2 / (2 * R^2)) * cos(pi * d / R)
    # At d -> R-, cos(pi) = -1, so d2s/dd2 = +(M - 1) * pi^2 / (2 * R^2)
    d2s_left = -(M - 1) * (math.pi ** 2 / (2 * R ** 2)) * math.cos(math.pi * (R - 1e-9) / R)
    d2s_right = 0.0
    jump_d2s = d2s_left - d2s_right
    expected_jump = (M - 1) * (math.pi ** 2) / (2 * (R ** 2))
    print(f"s''(R^-) = {d2s_left:.6e}, s''(R^+) = {d2s_right:.6e}")
    print(f"Second derivative jump at d=R: {jump_d2s:.6e} (expected: {expected_jump:.6e})")
    print(f"Is kernel C2 continuous at d=R? {math.isclose(jump_d2s, 0.0, abs_tol=1e-9)} (FALSE! Jump in acceleration)")
    
    # Derivative at d=0 (center of pointer)
    # d = |x_m - x_i|. Let x = x_m - x_i.
    # s(x) = 1 + (M-1) cos^2(pi * x / (2R)).
    # ds/dx at x=0: sin(0) = 0.
    # d2s/dx2 at x=0: -(M-1)*pi^2/(2*R^2) * cos(0) = -(M-1)*pi^2/(2*R^2).
    print(f"At center d=0: s'(0) = 0.0 (smooth stationary crest), s''(0) = {-expected_jump:.6e}")
    return True

def test_lenis_exponential_damping():
    print("\n=== 3. LENIS EXPONENTIAL DAMPING FRAME-RATE INDEPENDENCE ===")
    # Differential equation: dx/dt = lambda * (x* - x)
    # Discrete formula: x(t + dt) = target + (x(t) - target) * exp(-damping * dt)
    damping = 24.0 # s^-1
    target = 100.0
    x0 = 0.0
    total_time = 1.0 # 1000ms
    
    # Compare across different frame rates: 30 FPS, 60 FPS, 120 FPS, 144 FPS, and variable jittered dt
    fps_tests = [30, 60, 120, 240]
    final_positions = {}
    
    # Exact analytical solution: x(T) = target + (x0 - target) * exp(-damping * total_time)
    exact_x = target + (x0 - target) * math.exp(-damping * total_time)
    print(f"Exact Analytical Position at T={total_time}s: {exact_x:.12f}")
    
    for fps in fps_tests:
        dt = 1.0 / fps
        steps = int(round(total_time / dt))
        t = 0.0
        x = x0
        for _ in range(steps):
            x = target + (x - target) * math.exp(-damping * dt)
            t += dt
        final_positions[fps] = x
        error = abs(x - exact_x)
        print(f"FPS {fps:3d} (dt={dt*1000:6.2f}ms, steps={steps:3d}): final x = {x:.12f}, error = {error:.2e}")
        assert error < 1e-10, f"Frame rate discrepancy at {fps} FPS!"
        
    # Test naive linear lerp (alpha = 0.1 at 60 FPS) to demonstrate frame-rate dependence of bad lerp
    print("\nComparison with Naive Lerp (x_next = lerp(x, target, 0.1)):")
    for fps in [60, 120]:
        dt = 1.0 / fps
        steps = int(total_time / dt)
        x_naive = x0
        for _ in range(steps):
            x_naive = x_naive + 0.1 * (target - x_naive)
        print(f"Naive Lerp at {fps:3d} FPS: final x = {x_naive:.6f}")
    
    print("Lenis exp(-lambda*dt) mathematically proven strictly frame-rate invariant under constant target.")
    return True

def test_smpte_timecode_and_pll():
    print("\n=== 4. SMPTE TIMECODE & PLL MASTER-SLAVE SYNCHRONIZATION ===")
    targetFps = 30
    # Test timecode formatting across 108,000 frames (1 hour of video)
    discrepancies = []
    for frame in range(0, 108000, 17): # sample every 17 frames
        timeSeconds = frame / targetFps
        mins = math.floor(timeSeconds / 60)
        secs = math.floor(timeSeconds % 60)
        # Worker's formula: ms = Math.floor((timeSeconds - Math.floor(timeSeconds)) * 1000)
        ms = math.floor((timeSeconds - math.floor(timeSeconds)) * 1000)
        
        # Exact integer math reference:
        total_ms = round(frame * 1000 / targetFps)
        ref_mins = total_ms // 60000
        ref_secs = (total_ms % 60000) // 1000
        ref_ms = total_ms % 1000
        
        # Check if ms drift occurs
        if abs(ms - ref_ms) > 1: # more than 1ms rounding discrepancy
            discrepancies.append((frame, f"{mins:02d}:{secs:02d}.{ms:03d}", f"{ref_mins:02d}:{ref_secs:02d}.{ref_ms:03d}"))
            
    print(f"Frames tested up to 108000. Total rounding discrepancies > 1ms: {len(discrepancies)}")
    if discrepancies:
        print(f"Sample discrepancy at frame {discrepancies[0][0]}: Worker={discrepancies[0][1]} vs Exact={discrepancies[0][2]}")
        
    # Analyze PLL controller dynamics:
    # Error epsilon = t_audio - t_visual
    # Soft nudge: timeScale = 1.0 + clamp(1.25 * epsilon, -0.06, 0.06) for |epsilon| in [8ms, 35ms]
    # Hard seek: for |epsilon| > 35ms
    # Deadband: for |epsilon| < 8ms, timeScale = 1.0
    print("\nPLL Stability & Boundary Discontinuity Analysis:")
    epsilons = [0.0079, 0.0080, 0.0081, 0.0349, 0.0350, 0.0351]
    for eps in epsilons:
        if abs(eps) < 0.008:
            ts = 1.0
            mode = "DEADBAND (1.0)"
        elif abs(eps) <= 0.035:
            ts = 1.0 + max(-0.06, min(0.06, 1.25 * eps))
            mode = "SOFT NUDGE"
        else:
            ts = 1.0
            mode = "HARD SEEK"
        print(f"Epsilon = {eps*1000:6.2f}ms -> timeScale = {ts:.6f} [{mode}]")
    
    # Boundary step at 8ms:
    step_at_8ms = (1.0 + 1.25 * 0.008) - 1.0
    print(f"Discontinuous velocity step at 8ms deadband threshold: +{step_at_8ms*100:.3f}% ({step_at_8ms:.4f})")
    print(f"Discontinuous velocity step at 35ms seek threshold: drops from {1.0 + 1.25*0.035:.5f} to 1.00000")
    return True

def test_web_audio_synth_dsp():
    print("\n=== 5. PROCEDURAL WEB AUDIO SYNTH DSP VERIFICATION ===")
    # playHapticClick(frequency=3800, duration=0.003, volume=0.04)
    # Triangle wave, exponential decay to 0.0001
    freq = 3800.0
    duration = 0.003
    v0 = 0.04
    v_end = 0.0001
    
    # Time constant tau: v(t) = v0 * exp(-t / tau)
    # v(duration) = v0 * exp(-duration / tau) = v_end
    # -duration / tau = ln(v_end / v0)
    tau = -duration / math.log(v_end / v0)
    print(f"Tactile click (3800Hz, 3ms):")
    print(f"Exponential decay time constant tau: {tau*1000:.4f}ms")
    print(f"Number of triangle wave cycles in 3ms: {duration * freq:.2f} cycles")
    
    # playRelaySnap():
    # Thud: freq=180Hz, duration=0.015s, v0=0.08
    freq_thud = 180.0
    dur_thud = 0.015
    print(f"\nRelay Snap Thud component (180Hz, 15ms):")
    print(f"Number of cycles in 15ms: {dur_thud * freq_thud:.2f} cycles")
    tau_thud = -dur_thud / math.log(v_end / 0.08)
    print(f"Thud tau: {tau_thud*1000:.4f}ms")
    
    # After 5ms:
    v_5ms = 0.08 * math.exp(-0.005 / tau_thud)
    print(f"Thud gain at 5ms: {v_5ms:.4f} (decayed by {(1 - v_5ms/0.08)*100:.1f}%)")
    
    # Delay mechanism in playRelaySnap: setTimeout(..., 4)
    print("\nRelay snap inter-click scheduling analysis:")
    print("Code uses: setTimeout(() => playHapticClick(4500, 0.005, 0.06), 4);")
    print("Vulnerability: setTimeout is clamped and subject to JavaScript main thread event loop jitter (typically 4-16ms on Windows).")
    print("Recommendation: Use Web Audio sample-accurate scheduling: playHapticClick(4500, 0.005, 0.06, startTime = ctx.currentTime + 0.004).")
    return True

if __name__ == "__main__":
    test_skiper_gooey_math()
    test_dock_magnification_kernel()
    test_lenis_exponential_damping()
    test_smpte_timecode_and_pll()
    test_web_audio_synth_dsp()
