from PIL import Image
import numpy as np
from numpy import log, tan, sin, cos, arcsin, arccosh, radians, \
                  degrees


def RGBToString(rgb_tuple):
    """
    Convert a color to a css readable string
    """
    
    color = 'rgb(%s,%s,%s)'% rgb_tuple
    return color

def closest(x,y, pixels, offset, best_colours):
    """
    Recursively finds the nearest colour in an image
    from a set of colours given a pixel.

    :param x: The x coordinate of the pixel.
    :param y: The y coordinate of the pixel
    :param offset: The offset to use to the search space.
    :param best_colours: List/Tuple of allowable colours

    :returns: the nearest colour from the best colours set
    """

    if pixels[x,y] in best_colours:
        return pixels[x,y]

    x_low = np.amax((0,x - offset))
    x_high = np.amin((x + offset, pixels.shape[0]-1))
    y_low = np.amax((0,y - offset))
    y_high = np.amin((y + offset, pixels.shape[1]-1))

    x_index = np.concatenate((np.ones(y_high-y_low) * x_low,
                              np.arange(x_low, x_high),
                              np.ones(y_high-y_low) * x_high,
                              np.arange(x_low, x_high)))

    y_index = \
      np.concatenate((np.arange(y_low,y_high,dtype='int'),
                      np.ones(x_high-x_low,dtype='int')*y_high,
                      np.arange(y_low,y_high,dtype='int'),
                      np.ones(x_high-x_low, dtype='int')*y_low))


    data = pixels[x_index.astype('int'),
                  y_index.astype('int')].flatten()

    counts = np.empty_like(best_colours)
    for i, col in enumerate(best_colours):
        counts[i] = (data==col).sum()

    if (counts.sum()==0):
        return closest(x, y, pixels, offset + 1, best_colours)

    return best_colours[np.argmax(counts)]
    
def posterize(image):
    """
    Reduces the number of colours in an image the only the most
    prevalent colours (colours that cover more than 1% of the image).

    This function addresses interpolation artefacts that causes
    problems in PIL

    :param image: A PIL image object
    """
    
    # make a greyscaled version for histograms
    g_im = image.convert('P', palette=Image.ADAPTIVE)

    # Get as a numpy array
    pixels = np.array(g_im)

    count, colours = np.histogram(pixels,
                                  pixels.max()-pixels.min() + 1)

    colours = np.array(colours, dtype=int)
    colours = colours[1:]

    # Take only colors that make up 1% of the image
    best_colours = colours[count > (.01 * pixels.size)]

    # Just use PIL if there aren't a subset of prevalent colours
    if ((best_colours.size < 2) or
        (best_colours.size > 15)):
        return g_im.convert('P',
                            palette=Image.ADAPTIVE,
                            colors=8)

    # Find pixels that aren't one of the best colours
    fix_index = np.zeros(pixels.shape, dtype=bool)
    for colour in best_colours:
        fix_mask = np.logical_or(pixels==colour, fix_index)

    fix_index = np.array((np.where(fix_mask==False)))

    # Loop through each pixel that needs to be adjusted and find
    # the nearest best colour
    for x,y in zip(fix_index[0], fix_index[1]):
        point = closest(x,y, pixels, 1, best_colours)
        pixels[x,y] = point

    # Remap the image with the new pixel values
    g_im.paste(Image.fromarray(pixels))

    n_colours = best_colours.size

    # Posterize the image so PIL will limit the colour map size
    return g_im.convert('P',
                        palette=Image.ADAPTIVE,
                        colors=n_colours)



# should refactored to not use all the values at once
def depth2time(z, vp, vs, rho,k1, dt):

    v_avg = np.cumsum(vp) / np.arange(z.size)
    t = 2 * z / v_avg

    if np.size(dt) == 1:
        new_t = np.arange(t[0],t[-1],dt)
    else:
        new_t = dt

    new_vp = np.interp(new_t, t, vp)
    new_vs = np.interp(new_t, t, vs)
    new_rho = np.interp(new_t, t, rho)
    new_k1 = np.interp(new_t, t, k1)
 
    return new_vp, new_vs, new_rho, new_k1, new_t
        

def akirichards(vp1, vs1, rho1, vp2, vs2, rho2, theta1):
    """
    This is the formulation from Avseth et al.,
    Quantitative seismic interpretation,
    Cambridge University Press, 2006. Adapted for a 4-term formula. 
    See http://subsurfwiki.org/wiki/Aki-Richards_equation

    :param vp1: The p-wave velocity of the upper medium.
    :param vs1: The s-wave velocity of the upper medium.
    :param rho1: The density of the upper medium.

    :param vp2: The p-wave velocity of the lower medium.
    :param vs2: The s-wave velocity of the lower medium.
    :param rho2: The density of the lower medium.
    
    :param theta1: An array of incident angles to use for reflectivity
                   calculation [degrees].

    :returns: a vector of len(theta1) containing the reflectivity
             value corresponding to each angle.
    
    """

    # We are not using this for anything, but will
    # critical_angle = arcsin(vp1/vp2)
    
    # Do we need to ensure that we get floats out before
    # computing sines?
    #vp1 = float(vp1)

    theta2 = degrees(arcsin(vp2/vp1*sin(radians(theta1))))

    # Compute the various parameters
    drho = rho2-rho1
    dvp = vp2-vp1
    dvs = vs2-vs1
    meantheta = (theta1+theta2)/2.0
    rho = (rho1+rho2)/2.0
    vp = (vp1+vp2)/2.0
    vs = (vs1+vs2)/2.0

    # Compute the coefficients 
    w = 0.5 * drho/rho
    x = 2 * (vs/vp1)**2 * drho/rho
    y = 0.5 * (dvp/vp)
    z = 4 * (vs/vp1)**2 * (dvs/vs)

    # Compute the terms
    term1 = w
    term2 = -1 * x * sin(radians(theta1))**2
    term3 = y / cos(radians(meantheta))**2
    term4 = -1 * z * sin(radians(theta1))**2
    
    return (term1 + term2 + term3 + term4)
    
def ricker(duration, dt, f):
    """
    Also known as the mexican hat wavelet, models the function:
    A =  (1-2 \pi^2 f^2 t^2) e^{-\pi^2 f^2 t^2}

    :param duration: The length in seconds of the wavelet.
    :param dt: is the sample interval in seconds (usually 0.001,
               0.002, 0.004)
    :params f: Center frequency of the wavelet (in Hz). If a list or tuple is
               passed, the first element will be used.

    :returns: ricker wavelets with center frequency f sampled at t.
    """


    freq = np.array(f)
     
    t = np.arange(-duration/2, duration/2 , dt)

    output = np.zeros((t.size, freq.size))
        
    for i in range(freq.size):
        pi2 = (np.pi ** 2.0)
        if ( freq.size == 1 ):
            fsqr = freq ** 2.0
        else:
            fsqr =  freq[i] ** 2.0
        tsqr = t ** 2.0
        pft = pi2 * fsqr * tsqr
        A = (1 - (2 * pft)) * np.exp(-pft)
        output[:,i] = A

    if freq.size == 1: output = output.flatten()
        
    return output / np.amax(output)
