'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Loader2, Download, Filter, Grid, SlidersHorizontal, Tag, User, Box, DollarSign, CheckCircle, XCircle, Info, AlertCircle, Database, Check, Image as ImageIcon, Maximize2, Store, Plus, Trash2, Globe } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Default Shopify stores
const DEFAULT_STORES = [
  { name: 'French Connection', url: 'https://www.frenchconnection.com', active: true },
  { name: 'Gymshark', url: 'https://www.gymshark.com', active: false },
  { name: 'Allbirds', url: 'https://www.allbirds.com', active: false },
  { name: 'Fashion Nova', url: 'https://www.fashionnova.com', active: false },
];

export default function DynamicShopifyScraper() {
  // Store Management
  const [stores, setStores] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shopify_stores');
      return saved ? JSON.parse(saved) : DEFAULT_STORES;
    }
    return DEFAULT_STORES;
  });
  const [currentStore, setCurrentStore] = useState(stores[0]);
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreUrl, setNewStoreUrl] = useState('');
  
  // State Management
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(24);
  const [scrapingAll, setScrapingAll] = useState(false);
  
  // Selection & Database States
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [uploadingToDb, setUploadingToDb] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState({ success: 0, failed: 0, skipped: 0 });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedProductImages, setSelectedProductImages] = useState(null);
  
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

  // Save stores to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shopify_stores', JSON.stringify(stores));
    }
  }, [stores]);

  // Fetch Collections when store changes
  useEffect(() => {
    if (currentStore) {
      fetchCollections();
      setSelectedCollection('');
      setAllProducts([]);
      setSelectedProducts(new Set());
    }
  }, [currentStore]);

  // Add new store
  const addStore = () => {
    if (!newStoreName || !newStoreUrl) {
      alert('Please enter both store name and URL');
      return;
    }

    // Validate URL
    try {
      const url = new URL(newStoreUrl);
      const newStore = {
        name: newStoreName,
        url: url.origin,
        active: false
      };

      setStores([...stores, newStore]);
      setNewStoreName('');
      setNewStoreUrl('');
      setShowAddStore(false);
      alert(`Store "${newStoreName}" added successfully!`);
    } catch (err) {
      alert('Invalid URL format. Please enter a valid URL (e.g., https://example.com)');
    }
  };

  // Delete store
  const deleteStore = (index) => {
    if (confirm(`Delete store "${stores[index].name}"?`)) {
      const newStores = stores.filter((_, i) => i !== index);
      setStores(newStores);
      if (currentStore === stores[index]) {
        setCurrentStore(newStores[0]);
      }
    }
  };

  // Switch store
  const switchStore = (store) => {
    setCurrentStore(store);
    setStores(stores.map(s => ({ ...s, active: s.url === store.url })));
  };

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${currentStore.url}/collections.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.collections) {
        setCollections(data.collections);
        setStats(prev => ({ ...prev, totalCollections: data.collections.length }));
      } else {
        setError('No collections found. This might not be a Shopify store.');
      }
    } catch (err) {
      setError(`Failed to fetch collections: ${err.message}`);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionProducts = async (handle, pageNum = 1) => {
    if (!handle) return [];
    
    try {
      const limit = 250;
      const url = `${currentStore.url}/collections/${handle}/products.json?limit=${limit}&page=${pageNum}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return data.products || [];
    } catch (err) {
      console.error(`Error fetching page ${pageNum}:`, err);
      return [];
    }
  };

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
          
          if (prods.length < 250) {
            hasMore = false;
          }
          
          page++;
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

  const handleCollectionSelect = async (handle) => {
    setSelectedCollection(handle);
    setCurrentPage(1);
    setLoading(true);
    setError('');
    setSelectedProducts(new Set());
    
    try {
      const prods = await scrapeAllCollectionProducts(handle);
      setAllProducts(prods);
      
      extractMetadata(prods);
      calculateStats(prods);
      
    } catch (err) {
      setError('Failed to load products: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(query) ||
        p.vendor?.toLowerCase().includes(query) ||
        p.product_type?.toLowerCase().includes(query)
      );
    }
    
    if (filters.vendor) {
      filtered = filtered.filter(p => p.vendor === filters.vendor);
    }
    
    if (filters.productType) {
      filtered = filtered.filter(p => p.product_type === filters.productType);
    }
    
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
    
    if (filters.priceMin || filters.priceMax) {
      filtered = filtered.filter(p => {
        if (!p.variants || p.variants.length === 0) return false;
        const price = parseFloat(p.variants[0].price);
        if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
        if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;
        return true;
      });
    }
    
    if (filters.availability !== 'all') {
      filtered = filtered.filter(p => {
        if (!p.variants || p.variants.length === 0) return false;
        const available = p.variants[0].available;
        return filters.availability === 'in-stock' ? available : !available;
      });
    }
    
    return filtered;
  }, [allProducts, filters]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, productsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

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

  const toggleProductSelection = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const selectAllOnPage = () => {
    const newSelected = new Set(selectedProducts);
    paginatedProducts.forEach(p => newSelected.add(p.id));
    setSelectedProducts(newSelected);
  };

  const selectAllFiltered = () => {
    const newSelected = new Set();
    filteredProducts.forEach(p => newSelected.add(p.id));
    setSelectedProducts(newSelected);
  };

  const deselectAll = () => {
    setSelectedProducts(new Set());
  };

  const transformProductForDB = (product) => {
    const variant = product.variants?.[0] || {};
    const allVariants = product.variants || [];
    
    const sizes = allVariants.map(v => v.title || v.option1).filter(Boolean);
    const images = product.images?.map(img => img.src) || [];
    
    let tagsArray = [];
    if (Array.isArray(product.tags)) {
      tagsArray = product.tags;
    } else if (typeof product.tags === 'string') {
      tagsArray = product.tags.split(',').map(t => t.trim());
    }
    
    const productUrl = `${currentStore.url}/products/${product.handle}`;
    
    const stripHtml = (html) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    };
    
    const toJsonbArray = (arr) => {
      if (!arr || arr.length === 0) return null;
      return arr.map(item => JSON.stringify(item));
    };
    
    return {
      p_id: null,
      p_product_name: product.title || 'Untitled Product',
      p_price: variant.price ? parseFloat(variant.price) : 0,
      p_colour: tagsArray.find(t => t.toLowerCase().includes('color') || t.toLowerCase().includes('colour')) || null,
      p_description: stripHtml(product.body_html) || null,
      p_size: sizes.length > 0 ? sizes : ['One Size'],
      p_materials: product.body_html ? toJsonbArray([{ description: stripHtml(product.body_html) }]) : null,
      p_availability: variant.available || false,
      p_category_id: null,
      p_product_id: product.id ? parseInt(product.id) : Math.floor(Math.random() * 1000000000),
      p_colour_code: null,
      p_section: selectedCollection || null,
      p_product_family: product.product_type || null,
      p_product_family_en: product.product_type || null,
      p_product_subfamily: null,
      p_care: null,
      p_materials_description: stripHtml(product.body_html) || null,
      p_dimension: variant.weight ? `${variant.weight} ${variant.weight_unit}` : null,
      p_low_on_stock: (variant.inventory_quantity !== undefined && variant.inventory_quantity < 5) || false,
      p_sku: variant.sku || null,
      p_url: productUrl,
      p_currency: 'USD',
      p_image: images.length > 0 ? JSON.stringify(images.map(url => ({ url }))) : null,
      p_you_may_also_like: null,
      p_category_path: selectedCollection || null,
      p_scraped_category: product.product_type || null,
      p_scrape_type: currentStore.name, // Dynamic store name
      p_brand: product.vendor || currentStore.name,
      p_category: product.product_type || null,
      p_stock_status: variant.available ? 'in_stock' : 'out_of_stock',
      p_color: tagsArray.find(t => t.toLowerCase().includes('color') || t.toLowerCase().includes('colour')) || null,
      p_images: images.length > 0 ? JSON.stringify(images.map(url => ({ url }))) : null,
      p_product_url: productUrl,
      p_care_info: null
    };
  };

  const uploadSelectedToDatabase = async () => {
    if (selectedProducts.size === 0) {
      alert('Please select products to upload');
      return;
    }

    const selectedProds = allProducts.filter(p => selectedProducts.has(p.id));
    
    setUploadingToDb(true);
    setUploadProgress({ current: 0, total: selectedProds.length });
    setUploadResults({ success: 0, failed: 0, skipped: 0 });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < selectedProds.length; i++) {
      const product = selectedProds[i];
      setUploadProgress({ current: i + 1, total: selectedProds.length });

      try {
        const dbProduct = transformProductForDB(product);
        
        const { data: insertResult, error: insertError } = await supabase
          .rpc('upsert_zara_product_v6', dbProduct);

        if (insertError) {
          if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
            console.log(`Product ${product.title} already exists, skipping...`);
            skippedCount++;
          } else {
            console.error(`Failed to upload ${product.title}:`, insertError);
            failedCount++;
          }
        } else {
          console.log(`Successfully uploaded ${product.title}`);
          successCount++;
        }

      } catch (err) {
        console.error(`Error processing ${product.title}:`, err);
        failedCount++;
      }

      setUploadResults({ success: successCount, failed: failedCount, skipped: skippedCount });
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setUploadingToDb(false);
    alert(`Upload Complete!\n✓ Success: ${successCount}\n⊘ Skipped: ${skippedCount}\n✗ Failed: ${failedCount}`);
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredProducts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentStore.name.replace(/\s+/g, '-')}-products-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    let csv = 'ID,Title,Handle,Vendor,Type,Price,Compare Price,Available,SKU,Tags,Images,Variants,Weight,Inventory\n';
    
    filteredProducts.forEach(p => {
      const variant = p.variants?.[0] || {};
      const tags = Array.isArray(p.tags) ? p.tags.join(';') : (p.tags || '');
      const images = p.images?.map(img => img.src).join(';') || '';
      const variantCount = p.variants?.length || 0;
      
      csv += `${p.id},"${(p.title || '').replace(/"/g, '""')}",${p.handle || ''},${p.vendor || ''},${p.product_type || ''},${variant.price || ''},${variant.compare_at_price || ''},${variant.available || false},${variant.sku || ''},"${tags}","${images}",${variantCount},${variant.weight || ''},${variant.inventory_quantity || 0}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentStore.name.replace(/\s+/g, '-')}-products-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showImageGallery = (product) => {
    setSelectedProductImages(product);
    setShowImageModal(true);
  };

  const ProductCard = ({ product }) => {
    if (!product) return null;
    
    const variant = product.variants?.[0] || {};
    const image = product.images?.[0];
    const hasDiscount = variant.compare_at_price && parseFloat(variant.compare_at_price) > parseFloat(variant.price);
    const discount = hasDiscount ? (((parseFloat(variant.compare_at_price) - parseFloat(variant.price)) / parseFloat(variant.compare_at_price)) * 100).toFixed(0) : 0;
    const isSelected = selectedProducts.has(product.id);
    
    return (
      <div className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 border-2 ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'}`}>
        <div className="relative h-64 bg-gray-100">
          {image ? (
            <img src={image.src} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Package className="w-16 h-16 text-gray-300" /></div>
          )}
          
          <div className="absolute top-3 left-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleProductSelection(product.id);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'} shadow-lg hover:scale-110`}
            >
              {isSelected && <Check className="w-5 h-5" />}
            </button>
          </div>
          
          {hasDiscount && (
            <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
              -{discount}%
            </div>
          )}
          
          {product.images && product.images.length > 1 && (
            <button
              onClick={() => showImageGallery(product)}
              className="absolute bottom-3 right-3 bg-black bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 transition-all"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {product.images.length}
              </span>
            </button>
          )}
        </div>
        
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
            <div className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${variant.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {variant.available ? '✓ In Stock' : '✗ Out'}
            </div>
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
                  <Tag className="w-3 h-3" /> {typeof tag === 'string' ? tag.trim() : tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600">
            <span>{product.variants?.length || 0} variant{(product.variants?.length || 0) !== 1 ? 's' : ''}</span>
            <span>{product.images?.length || 0} image{(product.images?.length || 0) !== 1 ? 's' : ''}</span>
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
                <Globe className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Universal Shopify Scraper
                </h1>
                <p className="text-gray-600 mt-1">Scrape any Shopify store - Add unlimited stores dynamically</p>
              </div>
            </div>
          </div>
        </div>

        {/* Store Management */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Store className="w-6 h-6" /> Manage Stores
            </h2>
            <button
              onClick={() => setShowAddStore(!showAddStore)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Store
            </button>
          </div>

          {/* Add Store Form */}
          {showAddStore && (
            <div className="bg-blue-50 rounded-xl p-4 mb-4 border-2 border-blue-200">
              <h3 className="font-semibold mb-3 text-blue-900">Add New Shopify Store</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Store Name (e.g., Gymshark)"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="url"
                  placeholder="Store URL (e.g., https://www.gymshark.com)"
                  value={newStoreUrl}
                  onChange={(e) => setNewStoreUrl(e.target.value)}
                  className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={addStore}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Add Store
                </button>
                <button
                  onClick={() => setShowAddStore(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Store List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  currentStore.url === store.url
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                }`}
                onClick={() => switchStore(store)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Store className="w-4 h-4 text-blue-600" />
                      <h3 className="font-bold text-gray-800">{store.name}</h3>
                    </div>
                    <p className="text-xs text-gray-600 break-all">{store.url}</p>
                    {currentStore.url === store.url && (
                      <span className="inline-block mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  {stores.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStore(index);
                      }}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
            <div className="text-3xl font-bold">{selectedProducts.size}</div>
            <div className="text-purple-100 text-sm">Selected</div>
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
            <Grid className="w-6 h-6" /> Select Collection from {currentStore.name}
          </h2>
          
          <select
            value={selectedCollection}
            onChange={(e) => handleCollectionSelect(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            disabled={loading || collections.length === 0}
          >
            <option value="">-- Choose a Collection --</option>
            {collections.map(c => (
              <option key={c.id} value={c.handle}>
                {c.title} {c.products_count !== undefined ? `(${c.products_count} products)` : ''}
              </option>
            ))}
          </select>
          
          {collections.length === 0 && !loading && (
            <div className="mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800">No collections found. This might not be a Shopify store or collections are not accessible.</span>
            </div>
          )}
          
          {scrapingAll && (
            <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-800 font-medium">Scraping all products... This may take a moment.</span>
            </div>
          )}
        </div>

        {/* Selection Controls */}
        {selectedCollection && allProducts.length > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-6 mb-8 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold mb-1">Selection Controls</h3>
                <p className="text-blue-100 text-sm">{selectedProducts.size} products selected</p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={selectAllOnPage}
                  className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Select Page ({paginatedProducts.length})
                </button>
                
                <button
                  onClick={selectAllFiltered}
                  className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Select All ({filteredProducts.length})
                </button>
                
                <button
                  onClick={deselectAll}
                  className="bg-white text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Deselect All
                </button>
                
                <button
                  onClick={uploadSelectedToDatabase}
                  disabled={selectedProducts.size === 0 || uploadingToDb}
                  className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-bold flex items-center gap-2 shadow-lg"
                >
                  <Database className="w-5 h-5" /> 
                  {uploadingToDb ? 'Uploading...' : `Upload to Database (${selectedProducts.size})`}
                </button>
              </div>
            </div>
            
            {uploadingToDb && (
              <div className="mt-4 bg-white rounded-lg p-4">
                <div className="flex justify-between text-sm text-gray-700 mb-2">
                  <span>Uploading products...</span>
                  <span>{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span className="text-green-600">✓ Success: {uploadResults.success}</span>
                  <span className="text-yellow-600">⊘ Skipped: {uploadResults.skipped}</span>
                  <span className="text-red-600">✗ Failed: {uploadResults.failed}</span>
                </div>
              </div>
            )}
          </div>
        )}

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
            <p className="text-gray-600 text-lg">Loading products from {currentStore.name}...</p>
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
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
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
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
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
              <Globe className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Universal Shopify Scraper</h3>
            <p className="text-gray-600 mb-6">Add any Shopify store and start scraping products</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">🏪 Add Stores</h4>
                <p className="text-sm text-blue-700">Add unlimited Shopify stores dynamically</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">📦 Scrape Products</h4>
                <p className="text-sm text-green-700">Auto-fetch all products from any collection</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-2">💾 Save to DB</h4>
                <p className="text-sm text-purple-700">Upload to Supabase with one click</p>
              </div>
            </div>
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

      {/* Image Gallery Modal */}
      {showImageModal && selectedProductImages && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{selectedProductImages.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{selectedProductImages.images?.length || 0} images</p>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedProductImages.images?.map((img, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={img.src} 
                    alt={img.alt || `${selectedProductImages.title} - Image ${index + 1}`}
                    className="w-full h-64 object-cover rounded-lg shadow-md"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                    <a
                      href={img.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 transition-all flex items-center gap-2"
                    >
                      <Maximize2 className="w-4 h-4" /> View Full Size
                    </a>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                    {img.width} × {img.height}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}//test