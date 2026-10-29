"""Independent stdlib-only numerical fixture, not production solver code.

Reproduce: python src/modules/cd07/reference-fixtures.py
An exponential midpoint plant update retains the delay on a uniform grid.
Unlike the production error-filter/RK4 states, derivative action is decomposed
into an analytic reference kick and a filtered OUTPUT. Integral action uses
trapezoidal quadrature. Runs at h and h/2 expose the fixture's own convergence.
The multi-interval P and early P/PI/PID convolutions in math.test.ts are analytic.
"""
import json
import math


def fixture(step):
    gain, tau, delay = 1.0, 2.0, 0.5
    kp, ti, td, horizon = 4.8, 1.0, 0.25, 20.0
    tf, count, delay_cells = td / 10, round(horizon / step), round(delay / step)
    assert abs(delay_cells * step - delay) < 1e-12
    plant_decay, filter_decay = math.exp(-step / tau), math.exp(-step / tf)
    y, integral, filtered_y = 0.0, 0.0, 0.0
    controls = [11 * kp]
    output_at = {}
    iae, peak_y, peak_u, last_outside = 0.0, 0.0, 11 * kp, 0
    for n in range(count):
        past = n - delay_cells
        delayed_u = 0.0 if past < 0 else (controls[past] + controls[past + 1]) / 2
        next_y = plant_decay * y + gain * (1 - plant_decay) * delayed_u
        integral += step * (1 - (y + next_y) / 2)
        filtered_y = filter_decay * filtered_y + (1 - filter_decay) * (y + next_y) / 2
        t = (n + 1) * step
        control = kp * (1 - next_y + integral / ti + 10 * math.exp(-t / tf) - 10 * (next_y - filtered_y))
        controls.append(control)
        iae += step * (abs(1 - y) + abs(1 - next_y)) / 2
        y = next_y
        peak_y, peak_u = max(peak_y, y), max(peak_u, abs(control))
        if abs(1 - y) > .02:
            last_outside = n + 1
        for point in (1, 2, 5, 10, 20):
            if n + 1 == round(point / step):
                output_at[str(point)] = y
    return {"step": step, "y_at_seconds": output_at, "overshoot_percent": 100 * (peak_y - 1),
            "observed_entry_seconds": (last_outside + 1) * step,
            "iae": iae, "peak_effort": peak_u, "ending_error": 1 - y}


if __name__ == '__main__':
    print(json.dumps([fixture(.0001), fixture(.00005)], indent=2))
