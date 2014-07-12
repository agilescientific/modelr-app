# Helper function
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
    
def posterize(self,image):
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
    for colour in self.best_colours:
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
