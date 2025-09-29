'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Loader2, Download, Filter, Grid, List, SlidersHorizontal, Tag, User, Box, DollarSign, TrendingUp, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';

export default function ComprehensiveShopifyScraper() {
  const BASE_URL = 'https://www.frenchconnection.com';
  
  // State Management
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(24);
  const [viewMode, setViewMode] = useState('grid');
  const [scrapingAll, setScrapingAll] = useState(false);
  
  // Filter States
  const [filters, setFilters] = useState({
    vendor: '',
    productType: '',
    tag: '',
    priceMin: '',
    priceMax: '',
    availability: 'all',
    searchQuery: ''
  });
  
  // Metadata States
  const [vendors, setVendors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCollections: 0,
    avgPrice: 0,
    inStock: 0,
    outOfStock: 0
  });

  // Fetch Collections on Mount
  useEffect(() => {
    fetchCollections();
  }, []);

  // Fetch Collections
  const fetchCollections = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/collections.json`);
      const data = await response.json();
      
      if (data.collections) {
        setCollections(data.collections);
        setStats(prev => ({ ...prev, totalCollections: data.collections.length }));
      }
    } catch (err) {
      setError('Failed to fetch collections: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Products from Selected Collection
  const fetchCollectionProducts = async (handle, pageNum = 1) => {
    if (!handle) return [];
    
    try {
      const limit = 250; // Max per request
      const url = `${BASE_URL}/collections/${handle}/products.json?limit=${limit}&page=${pageNum}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.products || [];
    } catch (err) {
      console.error(`Error fetching page ${pageNum}:`, err);
      return [];
    }
  };

  // Scrape ALL Products from a Collection (Multi-page)
  const scrapeAllCollectionProducts = async (handle) => {
    setScrapingAll(true);
    setError('');
    let allProds = [];
    let page = 1;
    let hasMore = true;

    try {
      while (hasMore) {
        const prods = await fetchCollectionProducts(handle, page);
        
        if (prods.length === 0) {
          hasMore = false;
        } else {
          allProds = [...allProds, ...prods];
          
          // If less than 250, we've hit the last page
          if (prods.length < 250) {
            hasMore = false;
          }
          
          page++;
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return allProds;
    } catch (err) {
      setError('Error during full scrape: ' + err.message);
      return allProds;
    } finally {
      setScrapingAll(false);
    }
  };

  // Handle Collection Selection
  const handleCollectionSelect = async (handle) => {
    setSelectedCollection(handle);
    setCurrentPage(1);
    setLoading(true);
    setError('');
    
    try {
      const prods = await scrapeAllCollectionProducts(handle);
      setAllProducts(prods);
      setProducts(prods);
      
      // Extract unique vendors, types, tags
      extractMetadata(prods);
      calculateStats(prods);
      
    } catch (err) {
      setError('Failed to load products: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Extract Metadata (Vendors, Types, Tags)
  const extractMetadata = (prods) => {
    const vendorSet = new Set();
    const typeSet = new Set();
    const tagSet = new Set();
    
    prods.forEach(p => {
      if (p.vendor) vendorSet.add(p.vendor);
      if (p.product_type) typeSet.add(p.product_type);
      if (p.tags) {
        if (Array.isArray(p.tags)) {
          p.tags.forEach(t => tagSet.add(t));
        } else if (typeof p.tags === 'string') {
          p.tags.split(',').forEach(t => tagSet.add(t.trim()));
        }
      }
    });
    
    setVendors(Array.from(vendorSet).sort());
    setProductTypes(Array.from(typeSet).sort());
    setTags(Array.from(tagSet).sort());
  };

  // Calculate Statistics
  const calculateStats = (prods) => {
    let totalPrice = 0;
    let inStock = 0;
    let outOfStock = 0;
    
    prods.forEach(p => {
      if (p.variants && p.variants.length > 0) {
        const variant = p.variants[0];
        if (variant.price) {
          totalPrice += parseFloat(variant.price);
        }
        if (variant.available) {
          inStock++;
        } else {
          outOfStock++;
        }
      }
    });
    
    setStats({
      totalProducts: prods.length,
      totalCollections: collections.length,
      avgPrice: prods.length > 0 ? (totalPrice / prods.length).toFixed(2) : 0,
      inStock,
      outOfStock
    });
  };

  // Apply Filters
  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];
    
    // Search Query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(query) ||
        p.vendor?.toLowerCase().includes(query) ||
        p.product_type?.toLowerCase().includes(query)
      );
    }
    
    // Vendor Filter
    if (filters.vendor) {
      filtered = filtered.filter(p => p.vendor === filters.vendor);
    }
    
    // Product Type Filter
    if (filters.productType) {
      filtered = filtered.filter(p => p.product_type === filters.productType);
    }
    
    // Tag Filter
    if (filters.tag) {
      filtered = filtered.filter(p => {
        if (Array.isArray(p.tags)) {
          return p.tags.includes(filters.tag);
        } else if (typeof p.tags === 'string') {
          return p.tags.split(',').map(t => t.trim()).includes(filters.tag);
        }
        return false;
      });
    }
    
    // Price Range Filter
    if (filters.priceMin || filters.priceMax) {
      filtered = filtered.filter(p => {
        if (!p.variants || p.variants.length === 0) return false;
        const price = parseFloat(p.variants[0].price);
        if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
        if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;
        return true;
      });
    }
    
    // Availability Filter
    if (filters.availability !== 'all') {
      filtered = filtered.filter(p => {
        if (!p.variants || p.variants.length === 0) return false;
        const available = p.variants[0].available;
        return filters.availability === 'in-stock' ? available : !available;
      });
    }
    
    return filtered;
  }, [allProducts, filters]);

  // Pagination
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, productsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  // Reset Filters
  const resetFilters = () => {
    setFilters({
      vendor: '',
      productType: '',
      tag: '',
      priceMin: '',
      priceMax: '',
      availability: 'all',
      searchQuery: ''
    });
    setCurrentPage(1);
  };

  // Export Functions
  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredProducts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `french-connection-products-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    let csv = 'ID,Title,Handle,Vendor,Type,Price,Compare Price,Available,SKU,Tags,Images\n';
    
    filteredProducts.forEach(p => {
      const variant = p.variants?.[0] || {};
      const tags = Array.isArray(p.tags) ? p.tags.join(';') : (p.tags || '');
      const images = p.images?.map(img => img.src).join(';') || '';
      
      csv += `${p.id},"${(p.title || '').replace(/"/g, '""')}",${p.handle || ''},${p.vendor || ''},${p.product_type || ''},${variant.price || ''},${variant.compare_at_price || ''},${variant.available || false},${variant.sku || ''},"${tags}","${images}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `french-connection-products-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Product Card Component
  const ProductCard = ({ product }) => {
    if (!product) return null;
    
    const variant = product.variants?.[0] || {};
    const image = product.images?.[0];
    const hasDiscount = variant.compare_at_price && parseFloat(variant.compare_at_price) > parseFloat(variant.price);
    const discount = hasDiscount ? (((parseFloat(variant.compare_at_price) - parseFloat(variant.price)) / parseFloat(variant.compare_at_price)) * 100).toFixed(0) : 0;
    
    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 border border-gray-100">
        <div className="relative h-64 bg-gray-100">
          {image ? (
            <img src={image.src} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Package className="w-16 h-16 text-gray-300" /></div>
          )}
          
          {hasDiscount && (
            <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
              -{discount}%
            </div>
          )}
          
          <div className="absolute top-3 right-3">
            {variant.available ? (
              <div className="bg-green-500 text-white p-2 rounded-full"><CheckCircle className="w-4 h-4" /></div>
            ) : (
              <div className="bg-gray-500 text-white p-2 rounded-full"><XCircle className="w-4 h-4" /></div>
            )}
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            {product.vendor && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                <User className="w-3 h-3" /> {product.vendor}
              </span>
            )}
            {product.product_type && (
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1">
                <Box className="w-3 h-3" /> {product.product_type}
              </span>
            )}
          </div>
          
          <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 h-12">{product.title}</h3>
          
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl font-bold text-green-600">${variant.price || '0.00'}</span>
            {hasDiscount && (
              <span className="text-sm text-gray-500 line-through">${variant.compare_at_price}</span>
            )}
          </div>
          
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {(Array.isArray(product.tags) ? product.tags : product.tags.split(',')).slice(0, 3).map((tag, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {tag.trim()}
                </span>
              ))}
            </div>
          )}
          
          <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600">
            <span>{product.variants?.length || 0} variants</span>
            {variant.sku && <span>SKU: {variant.sku}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-4 rounded-xl">
                <Package className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  frenchconnection fetching api direct
                </h1>
                <p className="text-gray-600 mt-1">French Connection - Complete Catalog Browser</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
            <Package className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.totalProducts}</div>
            <div className="text-blue-100 text-sm">Total Products</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
            <Grid className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.totalCollections}</div>
            <div className="text-purple-100 text-sm">Collections</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
            <DollarSign className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">${stats.avgPrice}</div>
            <div className="text-green-100 text-sm">Avg Price</div>
          </div>
          
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl p-6 shadow-lg">
            <CheckCircle className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.inStock}</div>
            <div className="text-teal-100 text-sm">In Stock</div>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-6 shadow-lg">
            <XCircle className="w-8 h-8 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.outOfStock}</div>
            <div className="text-red-100 text-sm">Out of Stock</div>
          </div>
        </div>

        {/* Collection Selector */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Grid className="w-6 h-6" /> Select Collection
          </h2>
          
          <select
            value={selectedCollection}
            onChange={(e) => handleCollectionSelect(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            disabled={loading}
          >
            <option value="">-- Choose a Collection --</option>
            {collections.map(c => (
              <option key={c.id} value={c.handle}>
                {c.title} {c.products_count !== undefined ? `(${c.products_count} products)` : ''}
              </option>
            ))}
          </select>
          
          {scrapingAll && (
            <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-800 font-medium">Fetching all products... This may take a moment.</span>
            </div>
          )}
        </div>

        {/* Filters Section */}
        {selectedCollection && allProducts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-6 h-6" /> Filters
              </h2>
              <button
                onClick={resetFilters}
                className="text-sm bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
              >
                Reset All
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Products</label>
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
                  placeholder="Search by title, vendor, type..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
                <select
                  value={filters.vendor}
                  onChange={(e) => setFilters({...filters, vendor: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Vendors</option>
                  {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              
              {/* Product Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
                <select
                  value={filters.productType}
                  onChange={(e) => setFilters({...filters, productType: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              {/* Tag */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tag</label>
                <select
                  value={filters.tag}
                  onChange={(e) => setFilters({...filters, tag: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Tags</option>
                  {tags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              {/* Price Min */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Min Price</label>
                <input
                  type="number"
                  value={filters.priceMin}
                  onChange={(e) => setFilters({...filters, priceMin: e.target.value})}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Price Max */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Price</label>
                <input
                  type="number"
                  value={filters.priceMax}
                  onChange={(e) => setFilters({...filters, priceMax: e.target.value})}
                  placeholder="1000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Availability */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  value={filters.availability}
                  onChange={(e) => setFilters({...filters, availability: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Products</option>
                  <option value="in-stock">In Stock Only</option>
                  <option value="out-of-stock">Out of Stock Only</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {paginatedProducts.length} of {filteredProducts.length} products
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportToJSON}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export JSON
                </button>
                <button
                  onClick={exportToCSV}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Loading products...</p>
          </div>
        )}

        {/* Products Grid */}
        {!loading && paginatedProducts.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {paginatedProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-2xl shadow-xl p-6 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Page</span>
                  <span className="font-bold text-blue-600 text-xl">{currentPage}</span>
                  <span className="text-gray-600">of {totalPages}</span>
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && !selectedCollection && (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Info className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Select a Collection to Start</h3>
            <p className="text-gray-600">Choose a collection from the dropdown above to browse products</p>
          </div>
        )}

        {!loading && selectedCollection && filteredProducts.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Products Found</h3>
            <p className="text-gray-500">Try adjusting your filters or select a different collection</p>
          </div>
        )}
      </div>
    </div>
  );
}