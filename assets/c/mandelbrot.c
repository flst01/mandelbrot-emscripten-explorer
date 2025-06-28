/*
 * C Mandelbrot.
 * 
 * Usage: calculateMandelbrot(int width, int height, double centerX, double centerY, double sectionHeight, int maxIter, unsigned char *data, const char *gradient_str)
 *
 * This file is derived from the work of Tobias Brückner, published in 2016.
 * Original source: https://github.com/Toxe/mandelbrot-comparison/
 * Licensed under the MIT License.
 *
 * Modifications:
 * - Removed certain parts of the original code.
 * - emscripten compatibility for WebAssembly.
 *
 * Author of modifications: Florian Stolz
 * Date of modifications: 2025
 */

#include <emscripten.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#include <float.h>
#include <errno.h>
#include <limits.h>

typedef struct
{
    unsigned char r, g, b;
} pixel_color_t;

typedef struct
{
    float pos;
    float r, g, b;
} gradient_color_t;

typedef struct
{
    gradient_color_t *colors;
    int num_colors;
} gradient_t;

typedef struct
{
    int iter;
    float distance_to_next_iteration;
} calculation_result_t;

void die(char *reason)
{
    fprintf(stderr, "Runtime error: %s\n", reason);
    exit(1);
}

float lerp_float(const float a, const float b, const float t)
{
    return (1.0f - t) * a + t * b;
}

double lerp_double(const double a, const double b, const double t)
{
    return (1.0 - t) * a + t * b;
}

void cumsum(const int *iterations_histogram, int *cdf, int size)
{
    int total = 0;

    for (int i = 0; i < size; ++i) {
        total += iterations_histogram[i];
        cdf[i] = total;
    }
}

// Compare two float values for "enough" equality.
int equal_enough_float(float a, float b)
{
    a = fabsf(a);
    b = fabsf(b);

    return fabsf(a - b) <= fmaxf(a, b) * FLT_EPSILON;
}

// Compare two double values for "enough" equality.
int equal_enough_double(double a, double b)
{
    a = fabs(a);
    b = fabs(b);

    return fabs(a - b) <= fmax(a, b) * DBL_EPSILON;
}

gradient_color_t *gradient_get_color_at_position(gradient_t *gradient, float pos)
{
    for (int i = 0; i < gradient->num_colors; ++i)
        if (equal_enough_float(gradient->colors[i].pos, pos))
            return &gradient->colors[i];

    return NULL;
}

int cmp_color_pos_func(const void *p1, const void *p2)
{
    const gradient_color_t *a = (const gradient_color_t *) p1;
    const gradient_color_t *b = (const gradient_color_t *) p2;

    if (equal_enough_float(a->pos, b->pos))
        return 0;

    return (a->pos < b->pos) ? -1 : 1;
}

// Function to load gradient from a string instead of a file
gradient_t *load_gradient_from_string(const char *gradient_str) {
    gradient_t *gradient;
    char buf[256];
    char *line, *copy, *saveptr;

    if (!(gradient = (gradient_t *) malloc(sizeof(gradient_t))))
        die("alloc memory");

    gradient->num_colors = 2;

    if (!(gradient->colors = (gradient_color_t *) malloc((size_t) gradient->num_colors * sizeof(gradient_color_t))))
        die("alloc memory");

    gradient->colors[0].pos = 0.0;
    gradient->colors[0].r = 0.0;
    gradient->colors[0].g = 0.0;
    gradient->colors[0].b = 0.0;

    gradient->colors[1].pos = 1.0;
    gradient->colors[1].r = 1.0;
    gradient->colors[1].g = 1.0;
    gradient->colors[1].b = 1.0;

    copy = strdup(gradient_str);
    line = strtok_r(copy, "\n", &saveptr);

    while (line != NULL) {
        float pos, r, g, b;
        gradient_color_t *col;

        if (sscanf(line, "%f: %f, %f, %f", &pos, &r, &g, &b) == 4) {
            if (!(col = gradient_get_color_at_position(gradient, pos))) {
                gradient->num_colors++;
                gradient->colors = (gradient_color_t *) realloc(gradient->colors, (size_t) gradient->num_colors * sizeof(gradient_color_t));
                col = &gradient->colors[gradient->num_colors - 1];
            }

            col->pos = pos;
            col->r = r;
            col->g = g;
            col->b = b;
        }

        line = strtok_r(NULL, "\n", &saveptr);
    }

    free(copy);
    qsort(gradient->colors, (size_t) gradient->num_colors, sizeof(gradient_color_t), cmp_color_pos_func);
    return gradient;
}

void free_gradient(gradient_t *gradient)
{
    free(gradient->colors);
    free(gradient);
}

void color_from_gradient_range(const gradient_color_t *left, const gradient_color_t *right, float pos, pixel_color_t *color)
{
    const float relative_pos_between_colors = (pos - left->pos) / (right->pos - left->pos);
    color->r = (unsigned char) (255.0f * lerp_float(left->r, right->r, relative_pos_between_colors));
    color->g = (unsigned char) (255.0f * lerp_float(left->g, right->g, relative_pos_between_colors));
    color->b = (unsigned char) (255.0f * lerp_float(left->b, right->b, relative_pos_between_colors));
}

int color_from_gradient(const gradient_t *gradient, float pos, pixel_color_t *color)
{
    gradient_color_t *left = &gradient->colors[0];

    for (int i = 1; i < gradient->num_colors; ++i) {
        gradient_color_t *right = &gradient->colors[i];

        if (pos >= left->pos && pos <= right->pos) {
            color_from_gradient_range(left, right, pos, color);
            return 0;
        }

        left = right;
    }

    return -1;
}

void mandelbrot_calc(int image_width, int image_height, int max_iterations, double center_x, double center_y, double height,
                     int *iterations_histogram, calculation_result_t *results_per_point)
{
    const double width = height * ((double) image_width / (double) image_height);

    const double x_left   = center_x - width / 2.0;
    const double x_right  = center_x + width / 2.0;
    const double y_top    = center_y + height / 2.0;
    const double y_bottom = center_y - height / 2.0;

    const double bailout = 20.0;
    const double bailout_squared = bailout * bailout;
    const double log_log_bailout = log(log(bailout));
    const double log_2 = log(2.0);

    double final_magnitude = 0.0;

    memset(iterations_histogram, 0, (size_t) (max_iterations + 1) * sizeof(int));

    int pixel = 0;

    for (int pixel_y = 0; pixel_y < image_height; ++pixel_y) {
        const double y0 = lerp_double(y_top, y_bottom, (double) pixel_y / (double) image_height);

        for (int pixel_x = 0; pixel_x < image_width; ++pixel_x) {
            const double x0 = lerp_double(x_left, x_right, (double) pixel_x / (double) image_width);

            double x = 0.0;
            double y = 0.0;

            // iteration, will be from 1 .. max_iterations once the loop is done
            int iter = 0;

            while (iter < max_iterations) {
                const double x_squared = x * x;
                const double y_squared = y * y;

                if (x_squared + y_squared >= bailout_squared) {
                    final_magnitude = sqrt(x_squared + y_squared);
                    break;
                }

                y = 2.0 * x * y + y0;
                x = x_squared - y_squared + x0;

                ++iter;
            }

            if (iter < max_iterations) {
                ++iterations_histogram[iter]; // iter: 1 .. max_iterations-1, no need to count iterations_histogram[max_iterations]
                results_per_point[pixel].iter = iter;
                results_per_point[pixel].distance_to_next_iteration = 1.0f - fminf(1.0f, (float) ((log(log(final_magnitude)) - log_log_bailout) / log_2));
            } else {
                results_per_point[pixel].iter = iter;
                results_per_point[pixel].distance_to_next_iteration = 0.0;
            }

            ++pixel;
        }
    }
}

float *equalize_histogram(const int *iterations_histogram, const int max_iterations)
{
    const int size = max_iterations + 1;

    int *cdf;
    float *equalized_iterations;

    if (!(cdf = (int *) malloc((size_t) size * sizeof(int))))
        die("alloc memory");

    if (!(equalized_iterations = (float *) malloc((size_t) size * sizeof(float))))
        die("alloc memory");

    // Calculate the CDF (Cumulative Distribution Function) by accumulating all iteration counts.
    // Element [0] is unused and iterations_histogram[max_iterations] should be zero (as we do not count
    // the iterations of the points inside the Mandelbrot Set).
    cumsum(iterations_histogram, cdf, size);

    // Get the minimum value in the CDF that is bigger than zero and the sum of all iteration counts
    // from iterations_histogram (which is the last value of the CDF).
    int cdf_min = 0;

    for (int i = 0; i < size; ++i) {
        if (cdf[i] > 0) {
            cdf_min = cdf[i];
            break;
        }
    }

    const int total_iterations = cdf[size - 1];

    // normalize all values from the CDF that are bigger than zero to a range of 0.0 .. max_iterations
    const float f = (float) max_iterations / (float) (total_iterations - cdf_min);

    for (int i = 0; i < size; ++i)
        equalized_iterations[i] = cdf[i] > 0 ? f * (float) (cdf[i] - cdf_min) : 0.0f;

    free(cdf);

    return equalized_iterations;
}

void mandelbrot_colorize(const int image_width, const int image_height, const int max_iterations, const gradient_t *gradient,
                         pixel_color_t *image_data, const int *iterations_histogram, const calculation_result_t *results_per_point)
{
    float *equalized_iterations = equalize_histogram(iterations_histogram, max_iterations);

    for (int pixel = 0; pixel < image_width * image_height; ++pixel) {
        const calculation_result_t *results = &results_per_point[pixel];

        if (results->iter == max_iterations) {
            // points inside the Mandelbrot Set are always painted black
            image_data[pixel].r = 0;
            image_data[pixel].g = 0;
            image_data[pixel].b = 0;
        } else {
            // The equalized iteration value (in the range of 0 .. max_iterations) represents the
            // position of the pixel color in the color gradiant and needs to be mapped to 0.0 .. 1.0.
            // To achieve smooth coloring we need to edge the equalized iteration towards the next
            // iteration, determined by the distance between the two iterations.
            const float iter_curr = equalized_iterations[results->iter];
            const float iter_next = equalized_iterations[results->iter + 1];

            const float smoothed_iteration = lerp_float(iter_curr, iter_next, results->distance_to_next_iteration);
            const float pos_in_gradient = smoothed_iteration / (float) max_iterations;

            color_from_gradient(gradient, pos_in_gradient, &image_data[pixel]);
        }
    }

    free(equalized_iterations);
}

// Funktion zum Allokieren von Speicher für die Bilddaten
EMSCRIPTEN_KEEPALIVE
unsigned char* allocateBuffer(int width, int height) {
    return (unsigned char *)malloc(width * height * 4);
}

// Funktion zum Freigeben von Speicher
EMSCRIPTEN_KEEPALIVE
void freeBuffer(unsigned char *data) {
    free(data);
}

// Funktion zum Berechnen der Mandelbrotmenge und Rendern der Bilddaten
EMSCRIPTEN_KEEPALIVE
void calculateMandelbrot(int width, int height, double centerX, double centerY, double sectionHeight, int maxIter, unsigned char *data, const char *gradient_str) {
    // Allokieren von Speicher für die Bilddaten
    pixel_color_t *image_data = (pixel_color_t *)malloc(width * height * sizeof(pixel_color_t));
    if (!image_data) {
        die("alloc memory");
    }

    // Laden des Gradienten aus dem String
    gradient_t *gradient = load_gradient_from_string(gradient_str);
    if (!gradient) {
        die("unable to load gradient");
    }

    // Allokieren von Speicher für das Iterationshistogramm und die Ergebnisse
    int *iterations_histogram = (int *)malloc((size_t)(maxIter + 1) * sizeof(int));
    calculation_result_t *results_per_point = (calculation_result_t *)malloc((size_t)(width * height) * sizeof(calculation_result_t));
    if (!iterations_histogram || !results_per_point) {
        die("alloc memory");
    }

    // Berechnung der Mandelbrotmenge
    mandelbrot_calc(width, height, maxIter, centerX, centerY, sectionHeight, iterations_histogram, results_per_point);

    // Färbung der Mandelbrotmenge
    mandelbrot_colorize(width, height, maxIter, gradient, image_data, iterations_histogram, results_per_point);

    // Konvertieren der Bilddaten in das RGBA-Format für das Canvas
    for (int i = 0; i < width * height; ++i) {
        data[i * 4] = image_data[i].r;     // R
        data[i * 4 + 1] = image_data[i].g; // G
        data[i * 4 + 2] = image_data[i].b; // B
        data[i * 4 + 3] = 255;             // Alpha
    }

    // Freigabe des allokierten Speichers
    free(iterations_histogram);
    free(results_per_point);
    free_gradient(gradient);
    free(image_data);
}   
