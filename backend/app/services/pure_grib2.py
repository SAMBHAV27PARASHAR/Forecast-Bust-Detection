"""
SIH 26079: Pure Python WMO GRIB2 Template 5.0 (Simple Packing) Decoder
Decodes NOAA NOMADS GRIB2 subregion forecast slices (geavg, gespr) into NumPy arrays.
Zero native C compiler or external DLL dependencies.
"""

import struct
import numpy as np
from typing import List, Dict, Any, Optional

def parse_grib2_records(raw_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses all GRIB2 messages in a byte stream containing Template 5.0 (Grid point - simple packing).
    Returns list of records with grid definitions, metadata, and 1D NumPy arrays of values.
    """
    records = []
    data = raw_bytes
    pos = 0
    total_bytes = len(data)

    while pos < total_bytes:
        idx = data.find(b'GRIB', pos)
        if idx == -1 or idx + 16 > total_bytes:
            break

        discipline = data[idx + 6]
        edition = data[idx + 7]
        if edition != 2:
            pos = idx + 4
            continue

        total_len = struct.unpack('>Q', data[idx + 8:idx + 16])[0]
        sec_pos = idx + 16
        sec_end = idx + total_len

        if sec_end > total_bytes:
            break

        current_record = {
            'discipline': discipline,
            'edition': edition
        }

        while sec_pos < sec_end:
            if data[sec_pos:sec_pos + 4] == b'7777':
                break

            sec_len = struct.unpack('>I', data[sec_pos:sec_pos + 4])[0]
            if sec_len <= 0 or sec_pos + sec_len > sec_end:
                break

            sec_num = data[sec_pos + 4]
            sec_data = data[sec_pos:sec_pos + sec_len]

            if sec_num == 1:
                # Identification Section
                if sec_len >= 19:
                    year, month, day, hour, minute, second = struct.unpack('>HBBBBB', sec_data[12:19])
                    current_record['init_time'] = f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"

            elif sec_num == 3:
                # Grid Definition Section (Template 3.0: Equidistant Lat/Lon Grid)
                if sec_len >= 71:
                    template_num = struct.unpack('>H', sec_data[12:14])[0]
                    if template_num == 0:
                        ni, nj = struct.unpack('>II', sec_data[30:38])
                        lat1, lon1 = struct.unpack('>ii', sec_data[46:54])
                        lat2, lon2 = struct.unpack('>ii', sec_data[55:63])
                        dx, dy = struct.unpack('>II', sec_data[63:71])
                        current_record['grid'] = {
                            'ni': ni,
                            'nj': nj,
                            'lat1': lat1 / 1e6,
                            'lon1': lon1 / 1e6,
                            'lat2': lat2 / 1e6,
                            'lon2': lon2 / 1e6,
                            'dx': dx / 1e6,
                            'dy': dy / 1e6
                        }

            elif sec_num == 4:
                # Product Definition Section
                if sec_len >= 11:
                    template_num = struct.unpack('>H', sec_data[7:9])[0]
                    param_cat = sec_data[9]
                    param_num = sec_data[10]

                    # Forecast lead time
                    lead_h = struct.unpack('>I', sec_data[18:22])[0] if sec_len >= 22 else 0

                    # Surface level
                    surf_type = sec_data[22] if sec_len >= 23 else 0
                    surf_scale = sec_data[23] if sec_len >= 24 else 0
                    surf_val = struct.unpack('>I', sec_data[24:28])[0] if sec_len >= 28 else 0

                    current_record['pds'] = {
                        'template': template_num,
                        'category': param_cat,
                        'number': param_num,
                        'lead_hours': lead_h,
                        'surface_type': surf_type,
                        'surface_value': surf_val / (10 ** surf_scale) if surf_scale else surf_val
                    }

            elif sec_num == 5:
                # Data Representation Section (Template 5.0)
                if sec_len >= 21:
                    num_points = struct.unpack('>I', sec_data[5:9])[0]
                    template_num = struct.unpack('>H', sec_data[9:11])[0]
                    if template_num == 0:
                        R, E, D, N, orig_type = struct.unpack('>fhhBB', sec_data[11:21])
                        current_record['drs'] = {
                            'num_points': num_points,
                            'R': R,
                            'E': E,
                            'D': D,
                            'N': N,
                            'orig_type': orig_type
                        }

            elif sec_num == 6:
                current_record['bitmap_indicator'] = sec_data[5]

            elif sec_num == 7:
                # Data Section
                drs = current_record.get('drs', {})
                num_points = drs.get('num_points', 0)
                R = drs.get('R', 0.0)
                E = drs.get('E', 0)
                D = drs.get('D', 0)
                N = drs.get('N', 0)

                raw_data_bytes = sec_data[5:]

                if N == 0 or num_points == 0:
                    values = np.full(num_points, R * (10.0 ** -D), dtype=np.float32)
                else:
                    raw_bits = np.unpackbits(np.frombuffer(raw_data_bytes, dtype=np.uint8))
                    needed_bits = num_points * N
                    if len(raw_bits) >= needed_bits:
                        bits_reshaped = raw_bits[:needed_bits].reshape(num_points, N)
                        weights = (1 << np.arange(N - 1, -1, -1, dtype=np.uint64))
                        X = np.dot(bits_reshaped, weights)
                        values = (R + X.astype(np.float64) * (2.0 ** E)) * (10.0 ** -D)
                        values = values.astype(np.float32)
                    else:
                        values = np.array([], dtype=np.float32)

                current_record['values'] = values
                records.append(current_record)

                # Reset for any next field sharing the same GRIB message
                current_record = {
                    'discipline': discipline,
                    'edition': edition,
                    'init_time': current_record.get('init_time'),
                    'grid': current_record.get('grid')
                }

            sec_pos += sec_len

        pos = sec_end

    return records
